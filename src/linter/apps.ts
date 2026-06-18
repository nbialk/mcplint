import type { Finding, ResourceInfo } from "../model/types.js";
import { makeFinding } from "./finding.js";

export interface AppsCheckOptions {
  /** Promote directory-gating rules to "error" severity. */
  directory?: boolean;
}

/**
 * Layer-2 (MCP Apps) checks. Validates the Content-Security-Policy declared on
 * a UI resource. The OpenAI Apps SDK requires `_meta.ui.csp` before broad
 * distribution; we read it from the snapshot (resources/list) without fetching
 * or rendering any HTML, so this stays deterministic and side-effect free.
 */
export function checkResourceCsp(
  resource: ResourceInfo,
  opts: AppsCheckOptions = {},
): Finding[] {
  if (!resource.isUi) return [];

  const finding = makeFinding(opts.directory ?? false);
  const findings: Finding[] = [];
  const subject = resource.name || resource.uri;
  const extra = { resourceUri: resource.uri };

  if (!resource.cspDeclared) {
    findings.push(
      finding(
        "csp-missing",
        subject,
        "UI resource declares no CSP (_meta.ui.csp or openai/widgetCSP); the host sandbox blocks all network access.",
        extra,
      ),
    );
    return findings;
  }

  const csp = resource.csp ?? {};
  const connect = csp.connectDomains?.length ?? 0;
  const resources = csp.resourceDomains?.length ?? 0;
  if (connect === 0 && resources === 0) {
    findings.push(
      finding(
        "csp-domains-empty",
        subject,
        "CSP is declared but allowlists no connectDomains or resourceDomains; the widget cannot fetch or load assets.",
        extra,
      ),
    );
  }

  if ((csp.frameDomains?.length ?? 0) > 0) {
    findings.push(
      finding(
        "csp-frame-domains-declared",
        subject,
        "CSP declares frameDomains; embedding subframes is discouraged and draws higher review scrutiny.",
        extra,
      ),
    );
  }

  return findings;
}
