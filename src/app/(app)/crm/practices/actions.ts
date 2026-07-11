"use server";

import { runCreate, runUpdate, runDelete } from "@/lib/crm/action-runner";
import { CRM_REGISTRY } from "@/lib/crm/registry";
import type { ActionState } from "@/lib/action-result";

const config = CRM_REGISTRY.PRACTICE;

export async function createPracticeAction(_p: ActionState, fd: FormData) {
  return runCreate(config, fd);
}
export async function updatePracticeAction(_p: ActionState, fd: FormData) {
  return runUpdate(config, fd);
}
export async function deletePracticeAction(_p: ActionState, fd: FormData) {
  return runDelete(config, fd);
}
