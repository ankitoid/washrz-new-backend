import "dotenv/config";
import "../database.js";
import Catalog from "../models/catalogSchema.js";
import catalogSeed from "../config/catalogSeedData.js";

const seedCatalog = async () => {
  try {
    let created = 0;
    let updated = 0;

    for (const entry of catalogSeed) {
      const existingCategory = await Catalog.findOne({ slug: entry.slug });

      if (existingCategory) {
        existingCategory.label = entry.label;
        existingCategory.mainHeading = entry.mainHeading;
        existingCategory.mainDescription = entry.mainDescription;
        existingCategory.coverImage = entry.coverImage || "";
        existingCategory.sortOrder = entry.sortOrder || 0;
        existingCategory.items = entry.items;
        existingCategory.isActive = true;
        await existingCategory.save();
        updated += 1;
      } else {
        await Catalog.create(entry);
        created += 1;
      }
    }

    console.log(
      JSON.stringify(
        {
          status: "success",
          created,
          updated,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          status: "error",
          message: error.message,
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  } finally {
    process.exit();
  }
};

seedCatalog();
