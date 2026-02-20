# API Documentation

This backend consists of Bash shell scripts for AWS LBS management. Below are the main public scripts and their usage:

## Scripts

### deploy.sh

- **Purpose**: Deploys backend resources to AWS.
- **Usage**: `./deploy.sh <environment>`
- **Parameters**:
  - `environment`: Target environment (e.g., `dev`, `prod`)
- **Returns**: Exit code 0 on success, non-zero on failure.

### teardown.sh

- **Purpose**: Removes backend resources from AWS.
- **Usage**: `./teardown.sh <environment>`
- **Parameters**:
  - `environment`: Target environment
- **Returns**: Exit code 0 on success, non-zero on failure.

### status.sh

- **Purpose**: Checks the status of deployed resources.
- **Usage**: `./status.sh <environment>`
- **Parameters**:
  - `environment`: Target environment
- **Returns**: Prints resource status to stdout.

## Example

```sh
./deploy.sh dev
./status.sh dev
./teardown.sh dev
```
