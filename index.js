import Rx from 'rx';
import Octokat from 'octokat';
import config  from './config';

const { org, repo, token } = config;

const log = o => console.log(JSON.stringify(o, null, 2)); // eslint-disable-line no-console

const github = new Octokat({ token });

function getAllIssues() {
  return github.repos(org, repo).issues.fetch();
}

function getAllPRs() {
  return github.repos(org, repo).pulls.fetch();
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

function addLabelsToIssue(labels, issue) {
  return github.repos(org, repo).issues(issue.number).labels.create(labels);
}

const issues$ = Rx.Observable.fromPromise(getAllIssues());
const pulls$ = Rx.Observable.fromPromise(getAllPRs());

const issuesWithAssignedPR$ = issues$.combineLatest(pulls$).map(([issues, pulls]) => {
  return issuesWithAssignee(issuesWithPR(issues, pulls));
});

issuesWithAssignedPR$.subscribe(issues => {
  return issues.map(issue => {
    return addLabelsToIssue(['in review'], issue).then(log).catch(log);
  });
});
