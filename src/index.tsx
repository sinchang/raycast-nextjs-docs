import { ActionPanel, Action, List } from "@raycast/api";
import { useFetch, Response } from "@raycast/utils";
import { useState } from "react";

import { SearchResponse } from "./types";

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const { data, isLoading } = useFetch(
    "https://nntahqi9c5-2.algolianet.com/1/indexes/*/queries?x-algolia-api-key=e39a19eff01bf0b15e00a9ccf181bf25&x-algolia-application-id=NNTAHQI9C5",
    {
      parseResponse: parseFetchResponse,
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
          <SearchListItem key={searchResult.name} searchResult={searchResult} />
        ))}
      </List.Section>
    </List>
  );
}

function SearchListItem({ searchResult }: { searchResult: SearchResult }) {
  return (
    <List.Item
      title={searchResult.name}
      subtitle={searchResult.description}
      accessoryTitle={searchResult.username}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.OpenInBrowser title="Open in Browser" url={searchResult.url} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.CopyToClipboard
              title="Copy Install Command"
              content={`npm install ${searchResult.name}`}
              shortcut={{ modifiers: ["cmd"], key: "." }}
            />
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

  return json.results.map((result) => {
    return {
      name: result.package.name,
      description: result.package.description,
      username: result.package.publisher?.username,
      url: result.package.links.npm,
    } as SearchResult;
  });
}

interface SearchResult {
  name: string;
  description?: string;
  username?: string;
  url: string;
}
