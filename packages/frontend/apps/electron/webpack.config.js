// TODO(@forehalo): all packages would become 'module'
const path = require('node:path');

module.exports.config = {
  entry: {
    app: './renderer/index.tsx',
    shell: './renderer/shell/index.tsx',
  },
  output: {
    path: path.resolve(__dirname, './renderer/dist'),
  },
};
