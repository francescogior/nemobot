import t from 'tcomb';
import { startsWith, find } from 'lodash';

export const subIssueValidArrows = ['←', '&larr;', '&#8592;', '&#x2190;'];

const isStruct = (StructType, x) => {
  try {
    StructType({ ...x });
    return true;
  } catch (e) {
    return false;
  }
};

const PullRequest = t.struct({ pull_request: t.Object, repository: t.Object });

const Issue = t.struct({ issue: t.Object, repository: t.Object });

const SubIssue = t.struct({
  issue: t.refinement(t.Object, issue => !!find(subIssueValidArrows, arrow => startsWith(issue.body, `${arrow} #`))),
  repository: t.Object
});

const MacroIssue = t.struct({
  issue: t.refinement(t.Object, issue => !!find(issue.labels, { name: 'macro' })),
  repository: t.Object
});

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

const SubIssueEvent = t.struct({
  event: t.enums.of(['issues']),
  body: SubIssue
});

const MacroIssueEvent = t.struct({
  event: t.enums.of(['issues']),
  body: MacroIssue
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

const TestPlanReminderEvent = t.struct({
  event: t.enums.of(['reminder-test-plan']),
  body: PullRequest
});

const HophopEvent = t.struct({
  event: t.refinement(t.String, s => startsWith(s, 'hophop-')),
  body: t.struct({
    issue: t.maybe(t.Object),
    pull_request: t.maybe(t.Object),
    repository: t.Object
  })
});

const ExtensionEvent = t.struct({
  event: t.refinement(t.String, s => startsWith(s, 'extension-')),
  body: t.Object
});

const SplitMacroIssueEvent = t.struct({
  event: t.enums.of(['extension-split-macro-issue']),
  body: t.struct({
    macroIssueNumber: t.Number,
    repoName: t.String
  })
});

export const isEvent = x => isStruct(Event, x);
export const isPullRequestEvent = x => isStruct(PullRequestEvent, x);
export const isIssueEvent = x => isStruct(IssueEvent, x);
export const isSubIssueEvent = x => isStruct(SubIssueEvent, x);
export const isMacroIssueEvent = x => isStruct(MacroIssueEvent, x);
export const isReminderEvent = x => isStruct(ReminderEvent, x);
export const isTopicReminderEvent = x => isStruct(TopicReminderEvent, x);
export const isTestPlanReminderEvent = x => isStruct(TestPlanReminderEvent, x);
export const isHophopEvent = x => isStruct(HophopEvent, x);
export const isExtensionEvent = x => isStruct(ExtensionEvent, x);
export const isSplitMacroIssueEvent = x => isStruct(SplitMacroIssueEvent, x);
