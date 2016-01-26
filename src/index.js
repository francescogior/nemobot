import Rx from 'rx';
import Octokat from 'octokat';
import debug from 'debug';
const config = require('./config.json');

const prettifierLog = debug('prettifier');
const reviewStateLog = debug('prettifier:review state');
const _httpLog = debug('http');
const httpLog = x => _httpLog(JSON.stringify(x, null, 2));

function configForRepo(name) {
  const { org, token, repos, apiURL } = config;
  const repo = repos.filter(r => r.name === name)[0];
  return {
    name,
    org: repo && repo.org || org,
    github: new Octokat({
      token: repo && repo.token || token,
      rootURL: repo && repo.apiURL || apiURL
    })
  };
}

// adapted from https://github.com/philschatz/octokat.js/issues/38#issuecomment-116799519
function fetchAll(fn, args, acc = []) {
  const p = new Promise((resolve, reject) => {
    fn(args).then((val) => {
      if (val.nextPage) {
        fetchAll(val.nextPage, args, acc.concat(val)).then(resolve, reject);
      } else {
        resolve(acc.concat(val));
      }
    }, reject);
  });
  return p;
}

function getAllRepos(org) {
  const { token, apiURL: rootURL } = config;
  const github = new Octokat({ token, rootURL });
  return Rx.Observable.fromPromise(fetchAll(github.orgs(org).repos.fetch))
  .flatMap(repos => Rx.Observable.from(repos));
}

function getAllIssues(repoName) {
  const { github, org, name } = configForRepo(repoName);
  return Rx.Observable.fromPromise(
    fetchAll(github.repos(org, name).issues.fetch, { state: 'open' })
  ).map(issues => issues.filter(issue => !issue.pullRequest));
}

function getAllPRs(repoName) {
  const { github, org, name } = configForRepo(repoName);
  return Rx.Observable.fromPromise(fetchAll(github.repos(org, name).pulls.fetch));
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
  const { github, org, name } = configForRepo(repoName);
  const p = github.repos(org, name).issues(issue.number).labels.create(labels);
  return Rx.Observable.fromPromise(p);
}

function removeLabelFromIssue(repoName, label, issue) {
  const { github, org, name } = configForRepo(repoName);
  const p = github.repos(org, name).issues(issue.number).labels(label).remove();
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
  .flatMap(() => getAllRepos(config.org))
  .flatMap(repo => Rx.Observable.combineLatest(
    Rx.Observable.just(repo),
    getAllIssues(repo.name),
    getAllPRs(repo.name))
  )
  .subscribe(([repo, issues, pulls]) => {
    prettifierLog(`Updating review state in repo ${repo.name} (${issues.length} open issues, ${pulls.length} pull requests)`);
    processInReviewIssues(repo.name, issues, pulls);
  });
