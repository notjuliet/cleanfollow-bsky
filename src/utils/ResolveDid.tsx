export async function resolveDid(did) {
  const res = await fetch(
    did.startsWith("did:web") ?
      `https://${did.split(":")[2]}/.well-known/did.json`
      : "https://plc.directory/" + did,
  ).catch((error: unknown) => {
    console.warn("Failed to resolve DID", { error, did });
  });
  if (!res) return "";

  return res
    .json()
    .then((doc) => {
      for (const alias of doc.alsoKnownAs) {
        if (alias.includes("at://")) {
          return alias.split("//")[1];
        }
      }
    })
    .catch((error: unknown) => {
      console.warn("Failed to parse DID", { error, did });
      return "";
    });
};