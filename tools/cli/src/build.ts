import { PackageCommand } from './command';

export class BuildCommand extends PackageCommand {
  static override paths = [['build'], ['b']];

  async execute() {
    const args = ['affine build', this.package];

    if (this.deps) {
      args.push('--deps');
    }

    await this.cli.run(args);
  }
}
