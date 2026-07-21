import { createServerFn } from "@tanstack/react-start";

// Menu
export const getMenuAction = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await import("./db");
  const { requireHotelOwner } = await import("./auth");
  const user = await requireHotelOwner();
  return await db.menuItem.findMany({ where: { hotelId: user.hotelId! } });
});

export const saveMenuAction = createServerFn({ method: "POST" })
  .validator((data: any[]) => data)
  .handler(async ({ data }) => {
    const { db } = await import("./db");
    const { requireHotelOwner } = await import("./auth");
    const user = await requireHotelOwner();
    const hotelId = user.hotelId!;
    // Simple sync: delete all and recreate for now, or update
    await db.menuItem.deleteMany({ where: { hotelId } });
    await db.menuItem.createMany({
      data: data.map((item: any) => ({
        hotelId,
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        costPrice: item.costPrice
      }))
    });
    return { success: true };
  });

export const importDefaultMenuAction = createServerFn({ method: "POST" }).handler(async () => {
  const { db } = await import("./db");
  const { requireHotelOwner } = await import("./auth");
  const { newId } = await import("./lib/loyalty");
  const user = await requireHotelOwner();
  const hotelId = user.hotelId!;
  const existing = await db.menuItem.count({ where: { hotelId } });
  if (existing > 0) return { skipped: true, message: "Menu already has items" };
  const defaultItems = [
    { name: "Chicken Sandwich", price: 80, category: "Sandwiches" },
    { name: "Veg Sandwich", price: 60, category: "Sandwiches" },
    { name: "Chicken Burger", price: 100, category: "Burgers" },
    { name: "Veg Burger", price: 70, category: "Burgers" },
    { name: "French Fries", price: 60, category: "Fries" },
    { name: "Masala Fries", price: 70, category: "Fries" },
    { name: "Chicken Manchurian", price: 120, category: "Manchurian" },
    { name: "Veg Manchurian", price: 90, category: "Manchurian" },
    { name: "Chicken Noodles", price: 110, category: "Noodles" },
    { name: "Veg Noodles", price: 80, category: "Noodles" },
    { name: "Chicken Fried Rice", price: 110, category: "Rice" },
    { name: "Veg Fried Rice", price: 80, category: "Rice" },
    { name: "Steamed Momos (6pcs)", price: 70, category: "Momos" },
    { name: "Fried Momos (6pcs)", price: 90, category: "Momos" },
    { name: "Lemon Mojito", price: 60, category: "Mojito" },
    { name: "Watermelon Mojito", price: 70, category: "Mojito" },
  ];
  await db.menuItem.createMany({
    data: defaultItems.map(item => ({
      id: newId(),
      hotelId,
      name: item.name,
      price: item.price,
      category: item.category,
    }))
  });
  return { skipped: false, message: `Imported ${defaultItems.length} items` };
});

// Bills
export const getBillsAction = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await import("./db");
  const { requireHotelOwner } = await import("./auth");
  const user = await requireHotelOwner();
  return await db.bill.findMany({
    where: { hotelId: user.hotelId!, isDeleted: false },
    include: { items: true }
  });
});

export const addBillAction = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    const { db } = await import("./db");
    const { requireHotelOwner } = await import("./auth");
    const user = await requireHotelOwner();
    const hotelId = user.hotelId!;
    
    await db.bill.create({
      data: {
        id: data.id,
        hotelId,
        phone: data.phone,
        name: data.name,
        date: data.date,
        subtotal: data.subtotal,
        gstAmount: data.gstAmount,
        gstPercentage: data.gstPercentage,
        total: data.total,
        tableName: data.tableName,
        orderNo: data.orderNo,
        freeItemName: data.freeItem?.name,
        freeItemPrice: data.freeItem?.price,
        freeItemCost: data.freeItem?.costPrice,
        paymentMethod: data.paymentMethod ?? "CASH",
        splitCash: data.splitCash,
        splitGpay: data.splitGpay,
        items: {
          create: data.items.map((it: any) => ({
            name: it.name,
            price: it.price,
            qty: it.qty,
            costPrice: it.costPrice,
            isFree: it.isFree
          }))
        }
      }
    });
    return { success: true };
  });

export const deleteBillAction = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { db } = await import("./db");
    const { requireHotelOwner } = await import("./auth");
    const user = await requireHotelOwner();
    await db.bill.update({
      where: { id: data.id, hotelId: user.hotelId! },
      data: { isDeleted: true, deletedAt: new Date() }
    });
    return { success: true };
  });

export const updateBillAction = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    const { db } = await import("./db");
    const { requireHotelOwner } = await import("./auth");
    const user = await requireHotelOwner();
    const hotelId = user.hotelId!;
    // Delete old items and recreate
    await db.billItem.deleteMany({ where: { billId: data.id } });
    await db.bill.update({
      where: { id: data.id, hotelId },
      data: {
        phone: data.phone,
        name: data.name,
        date: data.date,
        subtotal: data.subtotal,
        gstAmount: data.gstAmount,
        gstPercentage: data.gstPercentage,
        total: data.total,
        tableName: data.tableName,
        orderNo: data.orderNo,
        freeItemName: data.freeItem?.name ?? null,
        freeItemPrice: data.freeItem?.price ?? null,
        freeItemCost: data.freeItem?.costPrice ?? null,
        paymentMethod: data.paymentMethod ?? "CASH",
        splitCash: data.splitCash ?? null,
        splitGpay: data.splitGpay ?? null,
        items: {
          create: data.items.map((it: any) => ({
            name: it.name,
            price: it.price,
            qty: it.qty,
            costPrice: it.costPrice,
            isFree: it.isFree
          }))
        }
      }
    });
    return { success: true };
  });

// Settings
export const getSettingsAction = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await import("./db");
  const { requireHotelOwner } = await import("./auth");
  const user = await requireHotelOwner();
  let settings = await db.settings.findUnique({ where: { hotelId: user.hotelId! } });
  if (!settings) {
    settings = await db.settings.create({ data: { hotelId: user.hotelId! } });
  }
  return {
    ...settings,
    tableNames: JSON.parse(settings.tableNames),
    categoryNames: JSON.parse(settings.categoryNames)
  };
});

export const saveSettingsAction = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    const { db } = await import("./db");
    const { requireHotelOwner } = await import("./auth");
    const user = await requireHotelOwner();
    await db.settings.update({
      where: { hotelId: user.hotelId! },
      data: {
        requireCustomerDetails: data.requireCustomerDetails,
        streakOfferEnabled: data.requireCustomerDetails ? data.streakOfferEnabled : false,
        freeItemsEnabled: data.freeItemsEnabled ?? false,
        tablesEnabled: data.tablesEnabled,
        printEnabled: data.printEnabled ?? false,
        tableNames: JSON.stringify(data.tableNames),
        categoryNames: JSON.stringify(data.categoryNames || []),
        gstPercentage: data.gstPercentage,
        hotelName: data.hotelName ?? "",
      }
    });
    return { success: true };
  });

export const saveCategoriesAction = createServerFn({ method: "POST" })
  .validator((data: string[]) => data)
  .handler(async ({ data }) => {
    const { db } = await import("./db");
    const { requireHotelOwner } = await import("./auth");
    const user = await requireHotelOwner();
    
    let settings = await db.settings.findUnique({ where: { hotelId: user.hotelId! } });
    if (settings) {
      await db.settings.update({
        where: { hotelId: user.hotelId! },
        data: { categoryNames: JSON.stringify(data) }
      });
    } else {
      await db.settings.create({
        data: { hotelId: user.hotelId!, categoryNames: JSON.stringify(data) }
      });
    }
    return { success: true };
  });

// Expenses
export const getExpensesAction = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await import("./db");
  const { requireHotelOwner } = await import("./auth");
  const user = await requireHotelOwner();
  return await db.expense.findMany({ where: { hotelId: user.hotelId! } });
});

export const addExpenseAction = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => {
    const { db } = await import("./db");
    const { requireHotelOwner } = await import("./auth");
    const user = await requireHotelOwner();
    const { newId } = await import("./lib/loyalty");
    await db.expense.create({
      data: {
        id: data.id || newId(),
        hotelId: user.hotelId!,
        date: data.date,
        description: data.description,
        amount: data.amount
      }
    });
    return { success: true };
  });

export const deleteExpenseAction = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { db } = await import("./db");
    const { requireHotelOwner } = await import("./auth");
    const user = await requireHotelOwner();
    await db.expense.delete({
      where: { id: data.id, hotelId: user.hotelId! }
    });
    return { success: true };
  });
