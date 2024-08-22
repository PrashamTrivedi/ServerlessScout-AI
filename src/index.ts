import yargs from 'yargs';
import chalk from 'chalk';
import ora from 'ora';

const spinner = ora('Processing...');

yargs
  .command({
    command: 'hello',
    describe: 'Say hello',
    handler: () => {
      spinner.start();
      setTimeout(() => {
        spinner.stop();
        console.log(chalk.green('Hello from the CLI!'));
      }, 1000);
    }
  })
  .help()
  .argv;
