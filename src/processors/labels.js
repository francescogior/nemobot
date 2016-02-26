import { includes, find } from 'lodash';
import {
  httpLog,
  prettifierLog,
  reviewStateLog,
  configForRepo
} from '../utils';

const labels = {
  macro: 'macro',
  inReview: 'in review',
  wip: 'WIP'
};

// utils
const hasLabel = ({ labels }, name) => !!find(labels, { name });

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

function processPullRequestState(repoName, pull) {
  const [, issueNumber] = pull.title.match(/\(closes #(\d+)\)/) || [];
  const isInReview = !!pull.assignee;

  function processInReviewAndWIP(_issue) {
    if (_issue.state === 'closed') {
      removeLabelFromIssue(repoName, labels.inReview, _issue).catch(httpLog);
      removeLabelFromIssue(repoName, labels.wip, _issue).catch(httpLog);
    } else if (isInReview) {
      addLabelsToIssue(repoName, [labels.inReview], _issue).catch(httpLog);
      removeLabelFromIssue(repoName, labels.wip, _issue).catch(httpLog);
    } else if (!isInReview) {
      addLabelsToIssue(repoName, [labels.wip], _issue).catch(httpLog);
      removeLabelFromIssue(repoName, labels.inReview, _issue).catch(httpLog);
    }
  }

  if (issueNumber) {
    const { github, org, name } = configForRepo(repoName);
    github.repos(org, name).issues(issueNumber).fetch()
      .then(processInReviewAndWIP)
      .catch(httpLog);
  }

  processInReviewAndWIP(pull);
}


export default subject => {
  const source = subject.filter(({ event }) => includes(['issues', 'pull_request'], event));

  // issues
  source
    .filter(({ body }) => body.issue)
    .subscribe(({ body: { issue, repository: repo } }) => {
      prettifierLog(`Updating labels of issue #${issue.number} in repo ${repo.name}`);
      processMacro(repo.name, issue);
    });

  // pulls
  source
    .filter(({ body }) => body.pull_request)
    .subscribe(({ body: { pull_request: pull, repository: repo } }) => {
      prettifierLog(`Updating labels of pull request #${pull.number} in repo ${repo.name}`);
      processPullRequestState(repo.name, pull);
    });
};
