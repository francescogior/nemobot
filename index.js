import Rx from 'rx';
import Octokat from 'octokat';
import config  from './config';
import debug from 'debug';

const prettifierLog = debug('prettifier');
const httpLog = x => debug('http')(JSON.prettify(x, null, 2));

const { org, repo, token, frequency } = config;

const github = new Octokat({ token });

function getAllIssues() {
  return Rx.Observable.fromPromise(github.repos(org, repo).issues.fetch());
}

function getAllPRs() {
  return Rx.Observable.fromPromise(github.repos(org, repo).pulls.fetch());
}

function issuesWithPR(issues, pulls) {
  return issues.filter(issue => {
    return pulls.filter(pull => {
      return pull.title.indexOf(`#${issue.number}`) !== -1;
    }).length > 0;
  });
}

function issuesWithAssignee(issues) {
  return issues.filter(issue => !!issue.assignee);
}

function issuesWithoutAssignee(issues) {
  return issues.filter(issue => !issue.assignee);
}

function issuesWithLabel(label) {
  return issues => issues.filter(issue => issue.labels.map(l => l.name).indexOf(label) !== -1);
}

function issuesWithoutLabel(label) {
  return issues => issues.filter(issue => issue.labels.map(l => l.name).indexOf(label) === -1);
}

function addLabelsToIssue(labels, issue) {
  const p = github.repos(org, repo).issues(issue.number).labels.create(labels);
  return Rx.Observable.fromPromise(p);
}

function removeLabelFromIssue(label, issue) {
  const p = github.repos(org, repo).issues(issue.number).labels(label).remove();
  return Rx.Observable.fromPromise(p);
}

function processInReviewIssues(issues, pulls) {
  prettifierLog(`Processing ${issues.length} issues`);

  const labelToAdd = issuesWithoutLabel('in review')(issuesWithPR(issues, issuesWithAssignee(pulls)));
  const labelToRemove = issuesWithLabel('in review')(issuesWithPR(issues, issuesWithoutAssignee(pulls)));

  labelToAdd.forEach(issue => {
    prettifierLog(`Adding 'in review' label to issue #${issue.number}`);
    addLabelsToIssue(['in review'], issue).catch(httpLog);
  });

  labelToRemove.forEach(issue => {
    prettifierLog(`Removing 'in review' label from issue #${issue.number}`);
    removeLabelFromIssue('in review', issue).catch(httpLog);
  });
}

prettifierLog('Starting the watch');
Rx.Observable.timer(0, frequency)
  .flatMap(() => Rx.Observable.combineLatest(getAllIssues(), getAllPRs()))
  .subscribe(([issues, pulls]) => {
    processInReviewIssues(issues, pulls);
  });
