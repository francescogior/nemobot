import { includes, find, filter } from 'lodash';
import {
  httpLog,
  prettifierLog,
  reviewStateLog,
  configForRepo
} from '../utils';
import { isPullRequestEvent, isIssueEvent, isHophopEvent } from '../validators';

const labels = {
  macro: 'macro',
  inReview: 'in review',
  wip: 'WIP'
};

// utils
const hasLabel = ({ labels }, name) => !!find(labels, { name });
const getAssociatedIssueNumber = pull => (pull.title.match(/\(closes #(\d+)\)/) || [])[1];

function addLabelsToIssue(repoName, _labels, issue) {
  const labels = _labels.filter(l => !hasLabel(issue, l));
  if (labels.length > 0) {
    const { github, org, name } = configForRepo(repoName);
    return github.repos(org, name).issues(issue.number).labels.create(labels);
  }
  return Promise.resolve();
}

function removeLabelFromIssue(repoName, label, issue) {
  if (hasLabel(issue, label)) {
    const { github, org, name } = configForRepo(repoName);
    return github.repos(org, name).issues(issue.number).labels(label).remove();
  }
  return Promise.resolve();
}

// processors
function processMacro(repoName, issue) {
  const subIssuesTitle = '## sub-issues';

  const isMacroIssue = includes(issue.body, subIssuesTitle);
  const hasMacroLabel = hasLabel(issue, labels.macro);

  if (isMacroIssue && !hasMacroLabel) {
    reviewStateLog(`Adding '${labels.macro}' label to issue #${issue.number} in ${repoName}`);
    addLabelsToIssue(repoName, [labels.macro], issue).catch(httpLog);
  } else if (!isMacroIssue && hasMacroLabel) {
    reviewStateLog(`Removing '${labels.macro}' label from issue #${issue.number} in ${repoName}`);
    removeLabelFromIssue(repoName, labels.macro, issue).catch(httpLog);
  }
}

function cleanClosedIssueLabels(repoName, issue) {
  if (issue.state === 'closed') {
    removeLabelFromIssue(repoName, labels.inReview, issue).catch(httpLog);
    removeLabelFromIssue(repoName, labels.wip, issue).catch(httpLog);
  }
}

function cleanClosedPRLabels(repoName, pull) {
  if (pull.state === 'closed') {
    const { github, org, name } = configForRepo(repoName);
    github.repos(org, name).issues(pull.number).fetch()
      .then(issue => cleanClosedIssueLabels(repoName, issue));
  }
}


function processPullRequestState(repoName, pull) {
  const issueNumber = getAssociatedIssueNumber(pull);
  const isInReview = !!pull.assignee;

  function processInReviewAndWIP(number) {
    const { github, org, name } = configForRepo(repoName);
    github.repos(org, name).issues(number).fetch()
      .then(_issue => {
        if (_issue.state === 'closed') {
          return; // let cleanClosedIssueLabels/cleanClosedPRLabels do the job
        } else if (isInReview) {
          addLabelsToIssue(repoName, [labels.inReview], _issue).catch(httpLog);
          removeLabelFromIssue(repoName, labels.wip, _issue).catch(httpLog);
        } else if (!isInReview) {
          addLabelsToIssue(repoName, [labels.wip], _issue).catch(httpLog);
          removeLabelFromIssue(repoName, labels.inReview, _issue).catch(httpLog);
        }
      })
      .catch(httpLog);
  }

  if (issueNumber) {
    processInReviewAndWIP(issueNumber);
  }
  processInReviewAndWIP(pull.number);
}

function syncPullRequestLabels(repoName, pull) {
  const issueNumber = getAssociatedIssueNumber(pull);
  if (issueNumber) {
    const { github, org, name } = configForRepo(repoName);

    const getIssue = github.repos(org, name).issues(issueNumber).fetch;
    const getPRIssue = github.repos(org, name).issues(pull.number).fetch;

    const filterOutInReviewAndWIP = (_labels) => filter(_labels, ({ name }) => !includes([labels.inReview, labels.wip], name));

    Promise.all([getIssue(), getPRIssue()])
      .then(([issue, PRIssue]) => {
        const labelsToAdd = filterOutInReviewAndWIP(issue.labels).map(({ name }) => name);
        const labelsToRemove = filterOutInReviewAndWIP(PRIssue.labels)
          .map(({ name }) => name)
          .filter(l => !hasLabel(issue, l));

        addLabelsToIssue(repoName, labelsToAdd, PRIssue).catch(httpLog);
        labelsToRemove.forEach(l => removeLabelFromIssue(repoName, l, PRIssue).catch(httpLog));
      });
  }
}

function processIssueWIP(repoName, issue) {
  const { github, org, name } = configForRepo(repoName);
  github.repos(org, name).issues(issue.number).fetch()
    .then(_issue => {
      addLabelsToIssue(repoName, [labels.wip], _issue).catch(httpLog);
    })
    .catch(httpLog);
}


export default ({ subject }) => {
  // issues
  subject
    .filter(isIssueEvent)
    .subscribe(({ body: { issue, repository: repo } }) => {
      prettifierLog(`Updating labels of issue #${issue.number} in repo ${repo.name}`);
      processMacro(repo.name, issue);
      cleanClosedIssueLabels(repo.name, issue);
    });

  // pulls
  subject
    .filter(isPullRequestEvent)
    .filter(({ body }) => !(body.pull_request.state === 'closed' && !body.pull_request.merged)) // ignore PRs closed without merge
    .subscribe(({ body: { pull_request: pull, repository: repo } }) => {
      prettifierLog(`Updating labels of pull request #${pull.number} in repo ${repo.name}`);
      processPullRequestState(repo.name, pull);
      syncPullRequestLabels(repo.name, pull);
      cleanClosedPRLabels(repo.name, pull);
    });

  // hophop issues
  subject
    .filter(isHophopEvent)
    .filter(({ body: { issue } }) => issue)
    .subscribe(({ body: { issue, repository: repo } }) => {
      prettifierLog(`[hophop] Updating labels of issue #${issue.number} in repo ${repo.name}`);
      processIssueWIP(repo.name, issue);
    });
};
