import { Path } from '@affine-tools/utils/path';
import { execAsync } from '@affine-tools/utils/process';
import type { PackageName } from '@affine-tools/utils/workspace';

import { Option, PackageCommand } from './command';

interface RunScriptOptions {
  includeDependencies?: boolean;
  waitDependencies?: boolean;
}

const currentDir = Path.dir(import.meta.url);

const ignoreLoaderScripts = [
  'vitest',
  'vite',
  'ts-node',
  'prisma',
  'cap',
  'tsc',
  /electron(?!-)/,
];

export class RunCommand extends PackageCommand {
  static override paths = [[], ['run'], ['r']];

  static override usage = PackageCommand.Usage({
    description: 'AFFiNE Monorepo scripts',
    details: `
      \`affine web <script>\`    Run any script defined in package's package.json

      \`affine codegen\`         Generate the required files if there are any package added or removed

      \`affine clean\`           Clean the output files of ts, cargo, webpack, etc.

      \`affine bundle\`          Bundle the packages

      \`affine build\`           A proxy for <-p package>'s \`build\` script

      \`affine dev\`             A proxy for <-p package>'s \`dev\` script
    `,
    examples: [
      [`See detail of each command`, '$0 -h'],
      [
        `Run custom 'xxx' script defined in @affine/web's package.json`,
        '$0 web xxx',
      ],
      [`Run 'codegen' for workspace`, '$0 codegen'],
      [`Clean tsbuild and dist under each package`, '$0 clean --ts --dist'],
      [`Clean node_modules under each package`, '$0 clean --node-modules'],
      [`Clean everything`, '$0 clean --all'],
      [`Run 'build' script for @affine/web`, '$0 build -p web'],
      [
        `Run 'build' script for @affine/web with all deps prebuild before`,
        '$0 build -p web --deps',
      ],
    ],
  });

  // we use positional arguments instead of options
  protected override packageNameOrAlias: string = Option.String({
    required: true,
    validator: this.packageNameValidator,
  });

  args = Option.Proxy({ name: 'args', required: 1 });

  async execute() {
    await this.run(this.package, this.args, {
      includeDependencies: this.deps,
      waitDependencies: true,
    });
  }

  async run(name: PackageName, args: string[], opts: RunScriptOptions = {}) {
    opts = { includeDependencies: false, ...opts };

    const pkg = this.workspace.getPackage(name);
    const script = args[0];
    const pkgScript = pkg.scripts[script];

    let isPackageJsonScript = false;
    let isAFFiNEScript = false;

    if (pkgScript) {
      isPackageJsonScript = true;
      isAFFiNEScript = pkgScript.startsWith('affine ');
    } else {
      isAFFiNEScript = script.startsWith('affine ');
    }

    if (isPackageJsonScript && opts.includeDependencies) {
      this.logger.info(
        `Running [${script}] script in dependencies of ${pkg.name}...`
      );

      await Promise.all(
        pkg.deps.map(dep => {
          this.logger.info(`Running [${script}] script in ${dep.name}...`);
          return this.run(dep.name, args, opts);
        })
      );
    }

    if (isPackageJsonScript) {
      this.logger.info(`Running [${script}] script in ${pkg.name}...`);
    }

    if (isAFFiNEScript) {
      await this.cli.run([
        ...pkgScript.split(' ').slice(1),
        ...args.slice(1),
        '-p',
        pkg.name,
      ]);
    } else {
      const script = pkgScript ?? args[0];
      // very simple test for auto ts/mjs scripts
      const isLoaderRequired = !ignoreLoaderScripts.some(ignore =>
        new RegExp(ignore).test(script)
      );

      await execAsync(name, ['yarn', ...args], {
        cwd: pkg.path.value,
        ...(isLoaderRequired
          ? {
              env: {
                NODE_OPTIONS: `--import=${currentDir.join('../register.js').toFileUrl()}`,
              },
            }
          : {}),
      });
    }
  }
}
