import type { DataProvider } from "ra-core";
import type { Deal } from "../types";
export const STAGE_CHANGED = "lead-stage-changed";
/** Ask for a next step without a stage change (e.g. after marking a task done). */
export const NEXT_STEP_REQUESTED = "lead-next-step-requested";
export function withStageNudge<T extends DataProvider>(provider: T): T {
  return {
    ...provider,
    async update(resource, params) {
      const result = await provider.update(resource, params);
      if (
        resource === "deals" &&
        params.data.stage &&
        params.previousData?.stage !== params.data.stage
      ) {
        window.dispatchEvent(
          new CustomEvent<Deal>(STAGE_CHANGED, {
            detail: result.data as unknown as Deal,
          }),
        );
      }
      return result;
    },
  };
}
