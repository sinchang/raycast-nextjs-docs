import { ActionPanel, Action, List, Icon } from "@raycast/api";
import { useFetch, Response } from "@raycast/utils";
import { useState } from "react";

import { SearchResponse } from "./types";

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const { data, isLoading } = useFetch(
    "https://nntahqi9c5-2.algolianet.com/1/indexes/*/queries?x-algolia-api-key=e39a19eff01bf0b15e00a9ccf181bf25&x-algolia-application-id=NNTAHQI9C5",
    {
      parseResponse: parseFetchResponse,
      method: "post",
      body: JSON.stringify({
        requests: [
          {
            indexName: "nextjs_new_docs",
            params: `facets=[]&highlightPostTag=__/ais-highlight__&highlightPreTag=__ais-highlight__&hitsPerPage=8&query=${searchText}&tagFilters=`,
          },
        ],
      }),
    }
  );

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search Next.js Documentation..."
      throttle
    >
      <List.Section title="Results" subtitle={data?.length + ""}>
        {data?.map((searchResult) => (
          <SearchListItem key={searchResult.content} searchResult={searchResult} />
        ))}
      </List.Section>
    </List>
  );
}

function SearchListItem({ searchResult }: { searchResult: SearchResult }) {
  return (
    <List.Item
      title={searchResult.content}
      icon={Icon.Document}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.OpenInBrowser title="Open in Browser" url={searchResult.path} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

/** Parse the response from the fetch query into something we can display */
async function parseFetchResponse(response: Response) {
  const json = (await response.json()) as SearchResponse | { code: string; message: string };

  if (!response.ok || "message" in json) {
    throw new Error("message" in json ? json.message : response.statusText);
  }

  const results: SearchResult[] = [];

  json.results[0].hits.forEach((result) => {
    results.push({
      content: result.isParent ? result.content : `${result.title} - ${result.content}`,
      path: `https://nextjs.org${result.path}${result.anchor ? `#${result.anchor}` : ""}`,
    });
  });

  return results;
}

interface SearchResult {
  content: string;
  path: string;
}
