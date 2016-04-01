import { configForRepo, prettifierLog } from '../utils';
import { some, includes } from 'lodash';
import { isIssueEvent, isReminderEvent, isTopicReminderEvent } from '../validators';

const topicLabels = ['web', 'api', 'escalapio', 'documentation'];

const hasAtLeastOneTopicLabel = labels => {
  const labelNames = labels.map(l => l.name);
  return some(topicLabels, tl => includes(labelNames, tl));
};

function addReminderIfMissingTopicLabel(repo, issue, action, onNext) {
  if (action === 'opened') {
    const { github, org, name } = configForRepo(repo.name);
    const getRepoLabels = github.repos(org, name).labels.fetch;

    getRepoLabels()
      .then(repoLabels => {
        const repoRequiresTopicLabel = hasAtLeastOneTopicLabel(repoLabels);
        const issueIsMissingTopicLabel = !hasAtLeastOneTopicLabel(issue.labels);
        if (repoRequiresTopicLabel && issueIsMissingTopicLabel) {
          onNext({ event: 'reminder-topic-label', body: { issue, repository: repo } }, 1000);
        }
      });
  }
}

function addMissingTopicLabelComment(event, repoName, issue) {
  if (isTopicReminderEvent(event)) {
    const { github, org, name } = configForRepo(repoName);
    const getUpdatedIssue = github.repos(org, name).issues(issue.number).fetch;

    getUpdatedIssue()
      .then(issue => {
        const issueIsMissingTopicLabel = !hasAtLeastOneTopicLabel(issue.labels);
        if (issueIsMissingTopicLabel) {
          const topicLabelsStringified = topicLabels.map(l => `\`${l}\``).join(', ');
          github.repos(org, name).issues(issue.number).comments.create({
            body: `@${issue.user.login} don't forget to add a topic label (${topicLabelsStringified})`
          });
        }
      });
  }
}

export default ({ subject, onNext }) => {
  // issues
  subject
    .filter(isIssueEvent)
    .subscribe(({ body: { action, issue, repository: repo } }) => {
      prettifierLog(`Adding reminders to issue #${issue.number} in repo ${repo.name}`);
      addReminderIfMissingTopicLabel(repo, issue, action, onNext);
    });

  // reminders
  subject
    .filter(isReminderEvent)
    .subscribe(event => {
      const { body: { issue, repository: repo } } = event;
      prettifierLog(`Trigger reminders for issue #${issue.number} in repo ${repo.name}`);
      addMissingTopicLabelComment(event, repo.name, issue);
    });

};
