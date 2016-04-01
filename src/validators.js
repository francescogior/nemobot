import t from 'tcomb';
import { startsWith } from 'lodash';

const isStruct = (StructType, x) => {
  try {
    StructType({...x});
    return true;
  } catch (e) {
    return false;
  }
};

const PullRequest = t.struct({ pull_request: t.Object, repository: t.Object });

const Issue = t.struct({ issue: t.Object, repository: t.Object });

const Event = t.struct({
  event: t.String,
  body: t.struct({
    issue: t.maybe(t.Object),
    pull_request: t.maybe(t.Object),
    repository: t.Object
  })
});

const PullRequestEvent = t.struct({
  event: t.enums.of(['pull_request']),
  body: PullRequest
});

const IssueEvent = t.struct({
  event: t.enums.of(['issues']),
  body: Issue
});

const ReminderEvent = t.struct({
  event: t.refinement(t.String, s => startsWith(s, 'reminder-')),
  body: t.struct({
    issue: t.maybe(t.Object),
    pull_request: t.maybe(t.Object),
    repository: t.Object
  })
});

const TopicReminderEvent = t.struct({
  event: t.enums.of(['reminder-topic-label']),
  body: Issue
});

export const isEvent = x => isStruct(Event, x);
export const isPullRequestEvent = x => isStruct(PullRequestEvent, x);
export const isIssueEvent = x => isStruct(IssueEvent, x);
export const isReminderEvent = x => isStruct(ReminderEvent, x);
export const isTopicReminderEvent = x => isStruct(TopicReminderEvent, x);
