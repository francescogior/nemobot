import express from 'express';
import bodyParser from 'body-parser';
import processors from './processors';

const app = express();
app.use(bodyParser.json());

app.post('/', (req, res) => {
  const event = req.headers['x-github-event'];

  processors.forEach(p => p(event, req.body));

  res.send('👍');
});

app.listen(3000);
