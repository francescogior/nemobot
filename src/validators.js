import t from 'tcomb';

const isStruct = (StructType, x) => {
  try {
    StructType({...x});
    return true;
  } catch (e) {
    return false;
  }
};

const PullRequest = t.struct({ pull_request: t.Object });

const Issue = t.struct({ issue: t.Object });

const Event = t.struct({
  event: t.String,
  body: t.Object
});

const PullRequestEvent = t.struct({
  event: t.enums.of(['pull_request']),
  body: PullRequest
});

const IssueEvent = t.struct({
  event: t.enums.of(['issues']),
  body: Issue
});

export const isEvent = x => isStruct(Event, x);
export const isPullRequestEvent = x => isStruct(PullRequestEvent, x);
export const isIssueEvent = x => isStruct(IssueEvent, x);
