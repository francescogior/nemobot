import t from 'tcomb';
import  configJSON from '../config.json';

const Config = t.struct({
  org: t.enums.of(['buildo']),
  token: t.String,
  repos: t.list(t.struct({
    name: t.String,
    token: t.String,
    apiURL: t.String
  })),
  labelsTemplate: t.String,
  reminders: t.struct({
    missingTopicLabels: t.struct({
      topicLabels: t.list(t.String),
      delay: t.Number
    })
  })
}, 'Config');

export default Config(configJSON);
