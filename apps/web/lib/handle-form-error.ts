import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";

interface ValidationDetail {
  path: string;
  message: string;
}

/**
 * Routes an API error from a dialog's submit handler per the brief:
 * - 422 field-level errors go onto the form (inline, next to each input).
 * - Other *expected* errors (409 CONFLICT, 409 LAST_ADMIN, 401, 403, ...)
 *   are returned as a message to render as an inline banner in the dialog.
 * - Anything unexpected (500 INTERNAL, an unrecognised code, a network
 *   failure) is reported as a toast carrying the request id, not shown
 *   inline — there's no specific field or known cause to point at.
 */
export function handleApiFormError<T extends FieldValues>(
  error: unknown,
  form: UseFormReturn<T>,
): string | null {
  if (error instanceof ApiError) {
    if (error.code === "VALIDATION_FAILED" && Array.isArray(error.details)) {
      for (const detail of error.details as ValidationDetail[]) {
        if (detail.path) {
          form.setError(detail.path as Path<T>, { message: detail.message });
        }
      }
      return null;
    }

    if (error.code === "INTERNAL" || error.code === "UNKNOWN") {
      toast.error(error.message, {
        description: error.requestId ? `Request ID: ${error.requestId}` : undefined,
      });
      return null;
    }

    return error.message;
  }

  toast.error("Something went wrong. Please try again.");
  return null;
}
