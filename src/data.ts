import { createServerFn } from "@tanstack/react-start";

// Menu
export const getMenuAction = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await import("./db");
  const { requireHotelOwner } = await import("./auth");
  const { DEFAULT_MENU, newId } = await import("./lib/loyalty");
  const user = await requireHotelOwner();
  const hotelId = user.hotelId!;

  let items = await db.menuItem.findMany({ where: { hotelId } });
  if (items.length === 0) {
    await db.menuItem.createMany({
      data: DEFAULT_MENU.map((item) => ({
        id: newId(),
        hotelId,
        name: item.name,
        price: item.price,
        category: item.category,
      })),
    });
    items = await db.menuItem.findMany({ where: { hotelId } });
  }

  return items;
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
    // Tiffins
    { name: "Plain Dosa", price: 50, category: "Tiffins" },
    { name: "Masala Dosa", price: 70, category: "Tiffins" },
    { name: "Ghee Roast Dosa", price: 90, category: "Tiffins" },
    { name: "Mysore Masala Dosa", price: 85, category: "Tiffins" },
    { name: "Onion Rava Dosa", price: 80, category: "Tiffins" },
    { name: "Steamed Idli (2 pcs)", price: 40, category: "Tiffins" },
    { name: "Medu Vada (2 pcs)", price: 45, category: "Tiffins" },
    { name: "Onion Uttapam", price: 75, category: "Tiffins" },
    { name: "Ven Pongal", price: 60, category: "Tiffins" },
    { name: "Puri Bhaji (3 pcs)", price: 65, category: "Tiffins" },
    // Rice Specials
    { name: "South Indian Meals / Thali", price: 120, category: "Rice Specials" },
    { name: "Sambar Rice", price: 70, category: "Rice Specials" },
    { name: "Curd Rice", price: 60, category: "Rice Specials" },
    { name: "Lemon Rice", price: 65, category: "Rice Specials" },
    { name: "Tamarind Rice (Pulihora)", price: 65, category: "Rice Specials" },
    { name: "Bisi Bele Bath", price: 80, category: "Rice Specials" },
    { name: "Tomato Rice", price: 70, category: "Rice Specials" },
    { name: "Ghee Sambar Vada", price: 55, category: "Rice Specials" },
    // Starters & Specials
    { name: "Chicken 65", price: 130, category: "Starters & Specials" },
    { name: "Gobi 65", price: 90, category: "Starters & Specials" },
    { name: "Paneer 65", price: 110, category: "Starters & Specials" },
    { name: "Chicken Chukka", price: 140, category: "Starters & Specials" },
    { name: "Egg Poriyal / Burji", price: 60, category: "Starters & Specials" },
    { name: "Mutton Chukka", price: 180, category: "Starters & Specials" },
    { name: "Fish Fry (Seer / Nethili)", price: 160, category: "Starters & Specials" },
    // Biryani
    { name: "Hyderabadi Veg Dum Biryani", price: 120, category: "Biryani" },
    { name: "Ambur Chicken Biryani", price: 160, category: "Biryani" },
    { name: "Mutton Biryani", price: 220, category: "Biryani" },
    // Beverages & Desserts
    { name: "South Indian Filter Coffee", price: 30, category: "Beverages & Desserts" },
    { name: "Rava Kesari", price: 45, category: "Beverages & Desserts" },
    { name: "Paal Payasam", price: 50, category: "Beverages & Desserts" },
    { name: "Badam Milk", price: 40, category: "Beverages & Desserts" },
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
  const { DEFAULT_CATEGORIES } = await import("./lib/loyalty");
  const user = await requireHotelOwner();
  const hotelId = user.hotelId!;

  let settings = await db.settings.findUnique({ where: { hotelId } });
  if (!settings) {
    settings = await db.settings.create({
      data: {
        hotelId,
        categoryNames: JSON.stringify(DEFAULT_CATEGORIES),
        hotelName: "Ram Mess",
      },
    });
  } else if (!settings.categoryNames || settings.categoryNames === "[]") {
    await db.settings.update({
      where: { hotelId },
      data: { categoryNames: JSON.stringify(DEFAULT_CATEGORIES) },
    });
    settings.categoryNames = JSON.stringify(DEFAULT_CATEGORIES);
  }

  return {
    ...settings,
    tableNames: JSON.parse(settings.tableNames || "[]"),
    categoryNames: JSON.parse(settings.categoryNames || "[]"),
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
