import sourcemaps from 'rollup-plugin-sourcemaps';
import nodeResolve from 'rollup-plugin-node-resolve';
import alias from 'rollup-plugin-alias';
import buble from 'rollup-plugin-buble';
import {join} from 'path';

const outBase = join(__dirname, '..', 'build', 'temp', 'tests');

export default {
  entry: join(outBase, 'ts', 'test', 'harness', 'run.js'),
  dest: join(outBase, 'rollup', 'test.rollup.js'),
  sourceMap: true,
  format: 'cjs',
  exports: 'named',
  useStrict: true,
  external: [
    'buffer', 'path', 'assert'
  ],
  plugins: [
    alias({
      async: require.resolve('async-es')
    }),
    nodeResolve({
      main: true,
      jsnext: true,
      preferBuiltins: true
    }),
    sourcemaps({
      exclude: '**/*'
    }),
    buble({
      transforms: {
        dangerousForOf: true
      }
    })
  ]
};
