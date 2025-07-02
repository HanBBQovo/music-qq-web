"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

export interface TabDefinition {
  key: string;
  label: React.ReactNode;
  render: () => React.ReactNode;
}

interface TabbedPanelProps {
  tabs: TabDefinition[];
  defaultKey?: string;
  className?: string;
}

export const TabbedPanel: React.FC<TabbedPanelProps> = ({
  tabs,
  defaultKey,
  className,
}) => {
  const [activeKey, setActiveKey] = React.useState<string>(
    defaultKey || (tabs[0]?.key ?? "")
  );

  return (
    <Tabs
      value={activeKey}
      defaultValue={defaultKey}
      onValueChange={setActiveKey}
      className={className}
    >
      <TabsList className="w-full grid grid-cols-3 mx-2 my-2">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key} className="text-xs px-2">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent
          key={tab.key}
          value={tab.key}
          className="max-h-[300px] min-h-[120px] overflow-y-auto"
        >
          {tab.render()}
        </TabsContent>
      ))}
    </Tabs>
  );
};
