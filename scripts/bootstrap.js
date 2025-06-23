import readline from 'node:readline';
import { exec } from 'node:child_process';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter AWS Account ID: ', (accountId) => {
  rl.question('Enter AWS Region: ', (region) => {
    const command = `cd infrastructure && cdk bootstrap aws://${accountId}/${region}`;
    console.log(`Running: ${command}`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Stderr: ${stderr}`);
        return;
      }
      console.log(`Output: ${stdout}`);
    });
    rl.close();
  });
});
