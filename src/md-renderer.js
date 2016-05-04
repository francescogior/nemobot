import marked from 'marked-ast';
import MdRenderer from 'marked-to-md';
import { includes, find } from 'lodash';


function transform(ast, visitors) {

  let currentSection;
  let transformed = false;
  const transformedAst = ast.map(node => {
    let newBody;
    // handle subissues separately
    if (currentSection && visitors.onSubissues && includes(currentSection.text[0], 'sub-issues') && node.type === 'list') {
      newBody = visitors.onSubissues(node.body);
      transformed = true;
    }

    // keep track of the current section
    if (node.type === 'heading') {
      currentSection = node;
    }
    return {
      ...node,
      body: newBody || node.body
    };
  });

  return { transformedAst, transformed };
}

export function getSubIssuesList(input) {
  const ast = marked.parse(input);
  let currentSection;

  return find(ast, node => {
    // keep track of the current section
    if (node.type === 'heading') {
      currentSection = node;
    }
    return currentSection && includes(currentSection.text[0], 'sub-issues') && node.type === 'list';
  });
}

export default (input, visitors) => {
  const ast = marked.parse(input);

  const { transformedAst, transformed } = transform(ast, visitors);
  const toAppend = !transformed ? visitors.onEndWithNoTransformation() : [];

  const renderer = new MdRenderer({});
  return marked.render(transformedAst.concat(toAppend), renderer);
};
