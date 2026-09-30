import { MobileRefreshButton } from "./MobileRefreshButton";

const MobileHeader = ({ children }: { children: React.ReactNode }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-10 bg-secondary h-[calc(3.5rem+var(--safe-top))] pt-[var(--safe-top)] px-4 w-full flex justify-between items-center">
      {children}
      <MobileRefreshButton />
    </header>
  );
};

export default MobileHeader;
