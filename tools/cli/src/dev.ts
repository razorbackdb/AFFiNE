import { PackageCommand } from './command';

export class DevCommand extends PackageCommand {
  static override paths = [['dev'], ['d']];

  async execute() {
    const args = [this.package, 'dev'];

    if (this.deps) {
      args.push('--deps');
    }

    await this.cli.run(args);
  }
}
