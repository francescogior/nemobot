import Rx from 'rx';
import Octokat from 'octokat';
import debug from 'debug';
const config = require('./config.json');

const prettifierLog = debug('prettifier');
const reviewStateLog = debug('prettifier:review state');
const httpLog = x => debug('http')(JSON.prettify(x, null, 2));

function configForRepo(name) {
  const { owner, token, repos, apiURL } = config;
  const repo = repos.filter(r => r.name === name)[0];
  return {
    name,
    owner: repo.owner || owner,
    github: new Octokat({
      token: repo.token || token,
      rootURL: repo.apiURL || apiURL
    })
  };
}

function getAllIssues(repoName) {
  const { github, owner, name } = configForRepo(repoName);
  return Rx.Observable.fromPromise(github.repos(owner, name).issues.fetch());
}

function getAllPRs(repoName) {
  const { github, owner, name } = configForRepo(repoName);
  return Rx.Observable.fromPromise(github.repos(owner, name).pulls.fetch());
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

function addLabelsToIssue(repoName, labels, issue) {
  const { github, owner, name } = configForRepo(repoName);
  const p = github.repos(owner, name).issues(issue.number).labels.create(labels);
  return Rx.Observable.fromPromise(p);
}

function removeLabelFromIssue(repoName, label, issue) {
  const { github, owner, name } = configForRepo(repoName);
  const p = github.repos(owner, name).issues(issue.number).labels(label).remove();
  return Rx.Observable.fromPromise(p);
}

function processInReviewIssues(repoName, issues, pulls) {
  const labelToAdd = issuesWithoutLabel('in review')(issuesWithPR(issues, issuesWithAssignee(pulls)));
  const labelToRemove = issuesWithLabel('in review')(issuesWithPR(issues, issuesWithoutAssignee(pulls)));

  labelToAdd.forEach(issue => {
    reviewStateLog(`Adding 'in review' label to issue #${issue.number} in ${repoName}`);
    addLabelsToIssue(repoName, ['in review'], issue).catch(httpLog);
  });

  labelToRemove.forEach(issue => {
    reviewStateLog(`Removing 'in review' label from issue #${issue.number} in ${repoName}`);
    removeLabelFromIssue(repoName, 'in review', issue).catch(httpLog);
  });
}

prettifierLog('Starting the watch');
Rx.Observable.timer(0, config.frequency)
  .flatMap(() => Rx.Observable.from(config.repos.map(r => r.name)))
  .flatMap(repo => Rx.Observable.combineLatest(
    Rx.Observable.just(repo),
    getAllIssues(repo),
    getAllPRs(repo))
  )
  .subscribe(([repo, issues, pulls]) => {
    prettifierLog(`Updating review state in repo ${repo}`);
    processInReviewIssues(repo, issues, pulls);
  });
