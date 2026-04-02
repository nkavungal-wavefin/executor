# Hackathon Demo Setup

## SD Ticket > Playbook > Management Command Flow

### Prerequisite

1. Okteto is running locally
2. Payroll employer is created in okteto by visiting any payroll menu from next-wave, which will take to the onboarding flow. Without this, you will get "Employer Not Found" error
3. https://github.com/waveaccounting/payroll/pull/11264 is checked out from local payroll repo
4. executor is running with `bun run dev`. 
5. From http://localhost:8788/plugins/local-tools/sources/local-tools?tab=model&tool=demo.run-rake-task, run-rake-task is set to "Approval"
6. MoM is running locally

### Steps for testing setup

1. Run `okteto up payroll-devcontainer-only` from payroll repo
2. Update https://waveaccounting.atlassian.net/browse/MOR-2627 with the current business id
3. On slack, run eg. `@pockyclaw help me with https://waveaccounting.atlassian.net/browse/MOR-2627`
4. To reproduce the onboarding-block issue from next-wave, refer to the playbook: https://waveaccounting.atlassian.net/wiki/spaces/PR/pages/6362562659/Playbook+Contractor-Only+Onboarding+Stuck, but this would be a bit of work for non-payroll eng. You can check the task output and match that to the payroll PR for the command.
