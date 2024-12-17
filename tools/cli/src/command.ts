import { AliasToPackage } from '@affine-tools/utils/distribution';
import { Logger } from '@affine-tools/utils/logger';
import { type PackageName, Workspace } from '@affine-tools/utils/workspace';
import { Command as BaseCommand, Option } from 'clipanion';
import * as t from 'typanion';

import type { CliContext } from './context';

export abstract class Command extends BaseCommand<CliContext> {
  get logger() {
    // @ts-expect-error hack: Get the command name
    return new Logger(this.constructor.paths[0][0]);
  }

  get workspace() {
    return this.context.workspace;
  }
}

export abstract class PackageCommand extends Command {
  protected availablePackageNameArgs = (
    Workspace.PackageNames as string[]
  ).concat(Array.from(AliasToPackage.keys()));
  protected packageNameValidator = t.isOneOf(
    this.availablePackageNameArgs.map(k => t.isLiteral(k))
  );

  protected packageNameOrAlias = Option.String('--package,-p', {
    required: true,
    validator: this.packageNameValidator,
    description: 'The package name or alias to be run with',
  });

  get package(): PackageName {
    return (
      AliasToPackage.get(this.packageNameOrAlias as any) ??
      (this.packageNameOrAlias as PackageName)
    );
  }

  deps = Option.Boolean('--deps', false, {
    description:
      'Execute the same command in workspace dependencies, if defined.',
  });
}

export abstract class PackagesCommand extends Command {
  protected availablePackageNameArgs = (
    Workspace.PackageNames as string[]
  ).concat(Array.from(AliasToPackage.keys()));
  protected packageNameValidator = t.isOneOf(
    this.availablePackageNameArgs.map(k => t.isLiteral(k))
  );

  protected packageNamesOrAliases = Option.Array('--package,-p', {
    required: true,
    validator: t.isArray(this.packageNameValidator),
  });
  get packages() {
    return this.packageNamesOrAliases.map(
      name => AliasToPackage.get(name as any) ?? name
    );
  }

  deps = Option.Boolean('--deps', false, {
    description:
      'Execute the same command in workspace dependencies, if defined.',
  });
}

export { Option };
