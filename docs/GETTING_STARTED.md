# Getting Started

## Prerequisites

- AWS CLI installed and configured
- Bash shell (Linux/macOS/WSL)
- Appropriate AWS credentials with permissions for LBS

## Installation

1. Clone the repository:
   ```sh
   git clone <repo-url>
   cd onde_estou_backend
   ```
2. Make scripts executable:
   ```sh
   chmod +x deploy.sh teardown.sh status.sh
   ```

## Usage

- Deploy resources:
  ```sh
  ./deploy.sh dev
  ```
- Check status:
  ```sh
  ./status.sh dev
  ```
- Teardown resources:
  ```sh
  ./teardown.sh dev
  ```

## Troubleshooting

- Ensure AWS CLI is installed and configured (`aws configure`).
- Check script permissions if you see 'Permission denied'.
- Review AWS CLI output for error details.
