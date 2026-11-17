/**
 * Next writes an AGENTS.md into the repository root unless told not to. This
 * project keeps its documentation in README.md and nowhere else.
 */
const nextConfig = {
  agentRules: false,
};

export default nextConfig;
