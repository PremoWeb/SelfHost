<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ShieldAlert, Loader2, Key, Copy } from "lucide-svelte";
  import { toastStore } from "$lib/stores/toast";

  // Props - this would come from the parent component
  let { server } = $props<{ server: any }>();

  // State for the warning banner functionality
  let isReinstallDialogOpen = $state(false);
  let isReinstalling = $state(false);
  let isRetrievingPassword = $state(false);
  let retrievedPassword = $state("");
</script>

{#if !server.privateKeyId && server.vpsProviderId}
  <div
    class="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 rounded-lg border p-4 mt-2"
  >
    <div class="flex items-start gap-3">
      <ShieldAlert
        class="text-amber-600 dark:text-amber-500 mt-0.5 size-5 shrink-0"
      />
      <div class="flex-1 space-y-3">
        <div>
          <p class="text-amber-900 dark:text-amber-100 text-sm font-medium">
            No deployment key configured
          </p>
          <p class="text-amber-700 dark:text-amber-300 mt-1 text-xs">
            This server is linked to a cloud provider but doesn't have an SSH
            key. You can auto-generate one and reinstall the server, or retrieve
            the password for manual setup.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            variant="default"
            size="sm"
            onclick={() => (isReinstallDialogOpen = true)}
            disabled={isReinstalling}
            class="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {#if isReinstalling}
              <Loader2 class="mr-2 size-3 animate-spin" />
              Reinstalling...
            {:else}
              <Key class="mr-2 size-3" />
              Auto-Generate Key & Reinstall
            {/if}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onclick={async () => {
              isRetrievingPassword = true;
              const formData = new FormData();
              const response = await fetch(
                `/servers/${server.id}?/retrievePassword`,
                {
                  method: "POST",
                  body: formData,
                },
              );
              const result = await response.json();
              if (result.type === "success" && result.data?.password) {
                retrievedPassword = result.data.password;
                toastStore.success("Password retrieved successfully");
              } else {
                toastStore.error(
                  result.data?.message || "Failed to retrieve password",
                );
              }
              isRetrievingPassword = false;
            }}
            disabled={isRetrievingPassword}
          >
            {#if isRetrievingPassword}
              <Loader2 class="mr-2 size-3 animate-spin" />
            {:else}
              <Key class="mr-2 size-3" />
            {/if}
            Retrieve Password
          </Button>
        </div>
        {#if retrievedPassword}
          <div class="bg-background rounded border p-3">
            <div class="mb-2 flex items-center justify-between">
              <p class="text-xs font-medium">Root Password:</p>
              <Button
                variant="ghost"
                size="sm"
                class="h-6 px-2"
                onclick={() => {
                  navigator.clipboard.writeText(retrievedPassword);
                  toastStore.success("Password copied to clipboard");
                }}
              >
                <Copy class="mr-1 size-3" />
                Copy
              </Button>
            </div>
            <code class="text-xs font-mono break-all">{retrievedPassword}</code>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
