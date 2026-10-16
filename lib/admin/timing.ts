import "server-only";

// Privacy-safe timings: names are fixed code labels, never IDs, emails or tokens.
// Preview logs are enabled by default; other environments opt in explicitly.
export async function timeAdmin<T>(label:string, action:()=>PromiseLike<T>):Promise<T> {
  const started=performance.now();
  try {
    return await action();
  } finally {
    if (process.env.VERCEL_ENV==="preview" || process.env.ADMIN_PERF_LOGS==="1") {
      console.info("[admin-perf] "+label+" "+Math.round(performance.now()-started)+"ms");
    }
  }
}
