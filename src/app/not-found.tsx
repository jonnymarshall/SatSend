import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="root-not-found"
      className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you are looking for does not exist, or it may have been moved.
      </p>
      <Link
        id="root-not-found--home-link"
        href="/"
        className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted/40"
      >
        Go home
      </Link>
    </main>
  );
}
