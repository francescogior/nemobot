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

function issuesWithoutLabel(label) {
  return issues => issues.filter(issue => issue.labels.map(l => l.name).indexOf(label) === -1);
}

function addLabelsToIssue(labels, issue) {
  const p = github.repos(org, repo).issues(issue.number).labels.create(labels);
  return Rx.Observable.fromPromise(p);
}

function getIssuesWithAssignedPR() {
  const issues$ = getAllIssues();
  const pulls$ = getAllPRs();
  return issues$.combineLatest(pulls$).map(([issues, pulls]) => {
    return issuesWithAssignee(issuesWithPR(issues, pulls));
  });
}

function processInReviewIssues() {
  Rx.Observable.interval(frequency)
    .flatMap(getIssuesWithAssignedPR)
    .map(issuesWithoutLabel('in review'))
    .subscribe(issues => {
      prettifierLog(`Adding 'in review' label to ${issues.length} issues`);
      issues.forEach(issue => {
        return addLabelsToIssue(['in review'], issue).catch(httpLog);
      });
    });
}

processInReviewIssues();
