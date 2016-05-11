import 'babel-core/register';
import 'babel-polyfill';
import express from 'express';
import bodyParser from 'body-parser';
import Rx from 'rx';
import { find, some, upperFirst } from 'lodash';
import processors from './processors';
import getTemplates from './templates';
import * as validators from './validators';
import config from './config';

const platforms = config.platforms.map(p => `x-${p}-event`);
const subject = new Rx.Subject();

const isEvent = (x) => {
  const majorValidators = config.platforms.map(p => `is${upperFirst(p)}Event`);
  return some(majorValidators, v => validators[v](x));
};

const onNext = (event, delay) => {
  if (isEvent(event)) {
    setTimeout(() => subject.onNext(event), delay);
  }
};

processors.forEach(p => p({ subject, onNext }));

const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(bodyParser.json());

app.post('/', ({ body, headers }, res) => {
  const event = headers[find(platforms, p => headers[p])];

  if (event) {
    onNext({ event, body });
    res.send('👍');
  } else {
    res.status(403).send('Forbidden');
  }
});

app.get('/templates', ({ query }, res) => {
  res.send(getTemplates(query));
});

app.listen(3000);
