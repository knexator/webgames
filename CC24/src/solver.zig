const std = @import("std");

const Direction = enum {
    up,
    down,
    left,
    right,
};

pub const Vec2 = struct {
    x: i8,
    y: i8,

    pub fn init(x: i8, y: i8) Vec2 {
        return .{ .x = x, .y = y };
    }

    pub fn equal(self: Vec2, other: Vec2) bool {
        return self.x == other.x and self.y == other.y;
    }

    pub fn isHor(self: Vec2) bool {
        return @mod(self.x + self.y, 2) == 0;
    }
};

const BoardState = struct {
    boat_pos: Vec2,
    rows: [4]i8,
    cols: [4]i8,

    pub fn next(self: BoardState, dir: Direction) ?BoardState {
        switch (dir) {
            .up, .down => {
                if (self.boat_pos.isHor()) return null;
                const dy: i8 = if (dir == .down) 1 else -1;
                const new_pos = Vec2.init(self.boat_pos.x, self.boat_pos.y + dy);

                // Check bounds
                if (new_pos.y < 0 or new_pos.y >= 4) return null;

                var result: BoardState = .{ .boat_pos = new_pos, .cols = self.cols, .rows = self.rows };
                result.moveCol(self.boat_pos.x, dy);

                return result;
            },
            .left, .right => {
                if (!self.boat_pos.isHor()) return null;
                const dx: i8 = if (dir == .right) 1 else -1;
                const new_pos = Vec2.init(self.boat_pos.x + dx, self.boat_pos.y);

                // Check bounds
                if (new_pos.x < 0 or new_pos.x >= 4) return null;

                var result: BoardState = .{ .boat_pos = new_pos, .cols = self.cols, .rows = self.rows };
                result.moveRow(self.boat_pos.y, dx);

                return result;
            },
        }
    }

    pub fn prev(self: BoardState, dir: Direction) ?BoardState {
        // any_state.next(dir).prev(dir) == any_state
        switch (dir) {
            .up, .down => {
                if (!self.boat_pos.isHor()) return null;
                const dy: i8 = if (dir == .down) 1 else -1;
                const new_pos = Vec2.init(self.boat_pos.x, self.boat_pos.y - dy);

                // Check bounds
                if (new_pos.y < 0 or new_pos.y >= 4) return null;

                var result: BoardState = .{ .boat_pos = new_pos, .cols = self.cols, .rows = self.rows };
                result.moveCol(self.boat_pos.x, -dy);

                return result;
            },
            .left, .right => {
                if (self.boat_pos.isHor()) return null;
                const dx: i8 = if (dir == .right) 1 else -1;
                const new_pos = Vec2.init(self.boat_pos.x - dx, self.boat_pos.y);

                // Check bounds
                if (new_pos.x < 0 or new_pos.x >= 4) return null;

                var result: BoardState = .{ .boat_pos = new_pos, .cols = self.cols, .rows = self.rows };
                result.moveRow(self.boat_pos.y, -dx);

                return result;
            },
        }
    }

    pub fn isWon(self: BoardState) bool {
        if (!self.boat_pos.equal(Vec2.init(3, 3))) return false;

        // if (self.rows[0] != 0) return false;
        if (self.cols[1] != 0) return false;
        // if (self.cols[2] != 0) return false;

        if (self.rows[1] != 0) return false;
        if (self.rows[2] != 0) return false;

        if (self.cols[3] != 0 or self.cols[3] != 2) return false;
        //...

        return true;
    }

    pub fn moveRow(self: *BoardState, index: i8, delta: i8) void {
        self.rows[@intCast(index)] = @mod(self.rows[@intCast(index)] + delta, 4);
    }

    pub fn moveCol(self: *BoardState, index: i8, delta: i8) void {
        self.cols[@intCast(index)] = @mod(self.cols[@intCast(index)] + delta, 4);
    }
};

fn solveBFS(allocator: std.mem.Allocator, initial_state: BoardState) !?BoardState {
    var queue = std.ArrayList(BoardState).init(allocator);
    defer queue.deinit();

    var visited = std.AutoHashMap(BoardState, ?Direction).init(allocator);
    defer visited.deinit();

    try queue.append(initial_state);
    try visited.put(initial_state, null);

    const final_state: ?BoardState = blk: {
        while (queue.items.len > 0) {
            const current = queue.orderedRemove(0);

            if (current.isWon()) break :blk current;

            inline for (@typeInfo(Direction).Enum.fields) |field| {
                const dir = @field(Direction, field.name);
                if (current.next(dir)) |next_state| {
                    if (!visited.contains(next_state)) {
                        try visited.put(next_state, dir);
                        try queue.append(next_state);
                    }
                }
            }
        }
        break :blk null;
    };

    if (final_state == null) return null;

    var cur_state = final_state.?;
    var path = std.ArrayList(Direction).init(allocator);
    defer path.deinit();

    std.debug.print("\n[\n", .{});
    while (visited.get(cur_state).?) |dir| {
        std.debug.print("\t'", .{});
        switch (dir) {
            .down => std.debug.print("down", .{}),
            .up => std.debug.print("up", .{}),
            .left => std.debug.print("left", .{}),
            .right => std.debug.print("right", .{}),
        }
        std.debug.print("',\n", .{});
        try path.append(dir);
        cur_state = cur_state.prev(dir).?;
    }
    std.debug.print("];\n", .{});

    return final_state;
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    std.debug.print("Starting puzzle solver...\n", .{});

    // Create initial state
    const initial_state = BoardState{
        .boat_pos = Vec2.init(0, 0),
        .rows = .{ 0, 0, 0, 0 },
        .cols = .{ 0, 0, 0, 0 },
    };

    std.debug.print("Searching for solution...\n", .{});

    // Find solution
    if (try solveBFS(allocator, initial_state)) |solution| {
        _ = solution; // autofix
        std.debug.print("Solution found!\n", .{});
        // std.debug.print("Final state:\n", .{});
        // for (0..4) |j| {
        //     const values: [4]u8 = undefined;
        //     _ = values; // autofix
        //     for (0..4) |i| {
        //         const is_hor = Vec2.init(i, j).isHor();
        //         if (is_hor) {}
        //         solution.rows[i];
        //     }
        // }
        // const path = try reconstructPath(solution, allocator);
        // defer path.deinit();

        // std.debug.print("Solution found! Steps: {d}\n", .{path.items.len});
        // std.debug.print("Path: ", .{});

        // for (path.items) |dir| {
        //     printDirection(dir);
        //     std.debug.print(" ", .{});
        // }
        // std.debug.print("\n", .{});
    } else {
        std.debug.print("No solution found!\n", .{});
    }
}
