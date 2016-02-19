import { includes, find, drop } from 'lodash';
import {
  httpLog,
  prettifierLog,
  reviewStateLog,
  configForRepo
} from '../utils';

const MACRO = 'macro';
const IN_REVIEW = 'in review';
const WIP = 'WIP';

// utils
const hasLabel = ({ labels }, name) => !!find(labels, { name });

function addLabelsToIssue(repoName, _labels, issue) {
  const labels = _labels.filter(l => !hasLabel(issue, l));
  if (labels.length > 0) {
    const { github, org, name } = configForRepo(repoName);
    return github.repos(org, name).issues(issue.number).labels.create(labels);
  }
}

function removeLabelFromIssue(repoName, label, issue) {
  if (hasLabel(issue, label)) {
    const { github, org, name } = configForRepo(repoName);
    return github.repos(org, name).issues(issue.number).labels(label).remove();
  }
}

// processors
function processMacro(repoName, issue) {
  const subIssuesTitle = '## sub-issues';

  const isMacroIssue = includes(issue.body, subIssuesTitle);
  const hasMacroLabel = hasLabel(issue, MACRO);

  if (isMacroIssue && !hasMacroLabel) {
    reviewStateLog(`Adding '${MACRO}' label to issue #${issue.number} in ${repoName}`);
    addLabelsToIssue(repoName, [MACRO], issue).catch(httpLog);
  } else if (!isMacroIssue && hasMacroLabel) {
    reviewStateLog(`Removing '${MACRO}' label from issue #${issue.number} in ${repoName}`);
    removeLabelFromIssue(repoName, MACRO, issue).catch(httpLog);
  }
}

function processPullRequestState(repoName, pull) {
  const issueNumber = drop(/\(closes #(\d+)\)/.exec(pull.title))[0];

  if (issueNumber) {
    const isInReview = !!pull.assignee;
    const { github, org, name } = configForRepo(repoName);

    github.repos(org, name).issues(issueNumber).fetch()
      .then(issue => {
        const isClosed = issue.state === 'closed';

        if (isClosed) {
          removeLabelFromIssue(repoName, IN_REVIEW, issue).catch(httpLog);
          removeLabelFromIssue(repoName, WIP, issue).catch(httpLog);
        } else if (isInReview) {
          addLabelsToIssue(repoName, [IN_REVIEW], issue).catch(httpLog);
          removeLabelFromIssue(repoName, WIP, issue).catch(httpLog);
        } else if (!isInReview) {
          addLabelsToIssue(repoName, [WIP], issue).catch(httpLog);
          removeLabelFromIssue(repoName, IN_REVIEW, issue).catch(httpLog);
        }
      })
      .catch(httpLog);
  }
}


export default (event, { issue, pull_request: pull, repository: repo }) => {
  if (includes(['issues', 'pull_request'], event)) {
    if (issue) {
      prettifierLog(`Updating labels of issue #${issue.number} in repo ${repo.name}`);
      processMacro(repo.name, issue);
    }

    if (pull) {
      prettifierLog(`Updating labels of pull request #${pull.number} in repo ${repo.name}`);
      processPullRequestState(repo.name, pull);
    }
  }
};
