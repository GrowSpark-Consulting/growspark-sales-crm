import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

interface Row {
  id: string;
  name: string;
}

const columns: DataTableColumn<Row>[] = [
  { key: "name", header: "Name", sortable: true, render: (row) => row.name },
];

const rows: Row[] = [
  { id: "1", name: "Acme" },
  { id: "2", name: "Beta" },
];

function baseProps() {
  return {
    columns,
    rows,
    rowKey: (row: Row) => row.id,
    page: 1,
    pageSize: 25,
    total: 2,
    onPageChange: vi.fn(),
    emptyTitle: "Nothing here",
    emptyDescription: "No rows match these filters.",
  };
}

describe("DataTable", () => {
  it("renders every row and column", () => {
    render(<DataTable {...baseProps()} />);

    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(screen.getByText("Name")).toBeTruthy();
  });

  it("shows the empty state (title, description, action) when there are no rows and it isn't loading", () => {
    render(
      <DataTable
        {...baseProps()}
        rows={[]}
        total={0}
        emptyTitle="No companies yet"
        emptyDescription="Add your first company."
        emptyAction={<button>Add company</button>}
      />,
    );

    expect(screen.getByText("No companies yet")).toBeTruthy();
    expect(screen.getByText("Add your first company.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add company" })).toBeTruthy();
  });

  it("shows a retry button in the error state, and calls onRetry when clicked", () => {
    const onRetry = vi.fn();
    render(<DataTable {...baseProps()} isError onRetry={onRetry} />);

    const retryButton = screen.getByRole("button", { name: "Try again" });
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Acme")).toBeNull();
  });

  it("renders loading skeleton rows instead of data while isLoading is true", () => {
    const { container } = render(<DataTable {...baseProps()} isLoading />);

    expect(screen.queryByText("Acme")).toBeNull();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("calls onSortChange with the column's sort field when a sortable header is clicked", () => {
    const onSortChange = vi.fn();
    render(<DataTable {...baseProps()} onSortChange={onSortChange} sort={{ field: "name", direction: "asc" }} />);

    fireEvent.click(screen.getByRole("button", { name: /Name/ }));

    expect(onSortChange).toHaveBeenCalledWith("name");
  });

  it("disables Previous on the first page and Next on the last page", () => {
    render(<DataTable {...baseProps()} page={1} pageSize={1} total={2} />);

    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("calls onPageChange with the next page when Next is clicked", () => {
    const onPageChange = vi.fn();
    render(<DataTable {...baseProps()} page={1} pageSize={1} total={2} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
