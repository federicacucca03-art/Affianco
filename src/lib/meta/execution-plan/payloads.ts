/**
 * ADV.2.1 — Pure Meta payload builders from Execution Plan nodes.
 * No network. No side effects. Never invent Meta IDs.
 * LIVE META WRITES: 0
 */

import type {
  ExecutionPlanAdNode,
  ExecutionPlanAdSetNode,
  ExecutionPlanCampaignNode,
  ExecutionPlanCreativeNode,
  MetaExecutionPlan,
  ProposedAdPayload,
  ProposedAdSetPayload,
  ProposedCampaignPayload,
  ProposedCreativePayload,
} from "@/lib/meta/execution-plan/types";

export function buildCampaignPayload(
  node: ExecutionPlanCampaignNode,
): ProposedCampaignPayload {
  return { ...node.payload };
}

export function buildAdSetPayload(
  node: ExecutionPlanAdSetNode,
): ProposedAdSetPayload {
  return {
    ...node.payload,
    targeting_summary: { ...node.payload.targeting_summary },
    promoted_object_keys: [...node.payload.promoted_object_keys],
  };
}

export function buildCreativePayload(
  node: ExecutionPlanCreativeNode,
): ProposedCreativePayload {
  return {
    ...node.payload,
    object_story_fields: { ...node.payload.object_story_fields },
  };
}

export function buildAdPayload(node: ExecutionPlanAdNode): ProposedAdPayload {
  return { ...node.payload };
}

/** Future Graph-shaped dump for Pro — still not sent. */
export function materializePlanPayloads(plan: MetaExecutionPlan): {
  campaign: ProposedCampaignPayload;
  adSets: ProposedAdSetPayload[];
  creatives: ProposedCreativePayload[];
  ads: ProposedAdPayload[];
} {
  return {
    campaign: buildCampaignPayload(plan.campaign),
    adSets: plan.adSets.map(buildAdSetPayload),
    creatives: plan.creatives.map(buildCreativePayload),
    ads: plan.ads.map(buildAdPayload),
  };
}
