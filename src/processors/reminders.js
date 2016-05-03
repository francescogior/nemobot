import fs from 'fs';
import { configForRepo, prettifierLog } from '../utils';
import { some, includes, find } from 'lodash';
import {
  isIssueEvent,
  isPullRequestEvent,
  isReminderEvent,
  isTopicReminderEvent,
  isTestPlanReminderEvent
} from '../validators';
import config from '../config';

const PRTemplate = fs.readFileSync('./templates/pr.md').toString();

const hasAtLeastOneTopicLabel = labels => {
  const { topicLabels } = config.reminders.missingTopicLabels;
  const labelNames = labels.map(l => l.name);
  return some(topicLabels, tl => includes(labelNames, tl));
};

function getRepoLabels(repoName) {
  const { github, org, name } = configForRepo(repoName);
  return github.repos(org, name).labels.fetch();
}

function addReminderIfMissingTopicLabel(repo, issue, action, onNext) {
  if (action === 'opened') {
    const { delay } = config.reminders.missingTopicLabels;

    getRepoLabels(repo.name)
      .then(repoLabels => {
        const repoRequiresTopicLabel = hasAtLeastOneTopicLabel(repoLabels);
        const issueIsMissingTopicLabel = !hasAtLeastOneTopicLabel(issue.labels);
        if (repoRequiresTopicLabel && issueIsMissingTopicLabel) {
          prettifierLog(`Adding reminder about missing topic label for issue #${issue.number} in repo ${repo.name}`);
          onNext({ event: 'reminder-topic-label', body: { issue, repository: repo } }, delay);
        }
      });
  }
}

function addMissingTopicLabelComment(event, repoName, oldIssue) {
  if (isTopicReminderEvent(event)) {
    const { topicLabels } = config.reminders.missingTopicLabels;
    const { github, org, name } = configForRepo(repoName);
    const getUpdatedIssue = github.repos(org, name).issues(oldIssue.number).fetch;

    getUpdatedIssue()
      .then(issue => {
        const issueIsMissingTopicLabel = !hasAtLeastOneTopicLabel(issue.labels);
        if (issueIsMissingTopicLabel) {
          prettifierLog(`Reminding to add topic label on issue #${issue.number} in repo ${repoName}`);
          getRepoLabels(repoName)
            .then(repoLabels => {
              const repoTopicLabels = topicLabels.filter(l => find(repoLabels, { name: l }));
              const topicLabelsStringified = repoTopicLabels.map(l => `\`${l}\``).join(', ');
              github.repos(org, name).issues(issue.number).comments.create({
                body: `@${issue.user.login} don't forget to add a topic label (${topicLabelsStringified})`
              });
            });
        }
      });
  }
}

function addReminderIfMissingTestPlan(repo, pull, action, onNext) {
  if (action === 'assigned') {
    const delay = 0; // remind test plan as soon as PR is assigned
    const TestPlanTemplate = PRTemplate.replace('Issue #$associatedIssueNumber\n\n', '');
    if (includes(pull.body, TestPlanTemplate)) {
      prettifierLog(`Adding reminder for missing test plan in PR #${pull.number} in repo ${repo.name}`);
      onNext({ event: 'reminder-test-plan', body: { pull, repository: repo } }, delay);
    }
  }
}

function addMissingTestPlanComment(event, repoName, oldPull) {
  if (isTestPlanReminderEvent(event)) {
    const { github, org, name } = configForRepo(repoName);

    // using oldPull as we're reminding test plan as soon as PR is assigned (delay is 0)
    github.repos(org, name).issues(oldPull.number).comments.create({
      body: `@${oldPull.user.login} don't forget to add a test plan`
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
