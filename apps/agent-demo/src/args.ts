export type AgentArgs = {
  query: string;
  budgetUsdc?: number;
  apiUrl?: string;
  dryRun: boolean;
};

const readValue = (args: string[], index: number, flag: string): string => {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
};

export const parseArgs = (argv = process.argv.slice(2)): AgentArgs => {
  let query = "Arc nanopayments creator monetization";
  let budgetUsdc: number | undefined;
  let apiUrl: string | undefined;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--query":
      case "-q":
        query = readValue(argv, index, arg);
        index += 1;
        break;
      case "--budget":
      case "--limit":
      case "-b":
        budgetUsdc = Number(readValue(argv, index, arg));
        index += 1;
        break;
      case "--api-url":
        apiUrl = readValue(argv, index, arg);
        index += 1;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      default:
        if (arg?.startsWith("--")) {
          throw new Error(`Unknown option: ${arg}`);
        }

        query = arg ?? query;
    }
  }

  if (budgetUsdc !== undefined && (!Number.isFinite(budgetUsdc) || budgetUsdc <= 0)) {
    throw new Error("--budget must be a positive USDC amount.");
  }

  return {
    query,
    dryRun,
    ...(budgetUsdc === undefined ? {} : { budgetUsdc }),
    ...(apiUrl === undefined ? {} : { apiUrl }),
  };
};
