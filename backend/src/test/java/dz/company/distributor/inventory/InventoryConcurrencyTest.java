package dz.company.distributor.inventory;

import dz.company.distributor.common.exception.InsufficientStockException;
import dz.company.distributor.products.Product;
import dz.company.distributor.products.ProductRepository;
import dz.company.distributor.warehouses.Warehouse;
import dz.company.distributor.warehouses.WarehouseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("dev")
public class InventoryConcurrencyTest {

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private StockRepository stockRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private ProductRepository productRepository;

    private Warehouse testWarehouse;
    private Product testProduct;

    @BeforeEach
    public void setup() {
        testWarehouse = warehouseRepository.findAll().get(0);
        testProduct = productRepository.save(new Product(
                "TEST-CONC-" + System.currentTimeMillis(),
                "Concurrency Test Drill",
                "KRAFT-TEST",
                new BigDecimal("10000.00"),
                new BigDecimal("15000.00"),
                "PIECE",
                true
        ));
    }

    @Test
    @DisplayName("Concurrent sales against finite stock must never drive inventory negative")
    public void testConcurrentStockDeduction() throws InterruptedException {
        int initialStock = 10;
        Stock stock = new Stock(testWarehouse, testProduct, initialStock, 0);
        stockRepository.save(stock);

        int numberOfThreads = 8;
        int quantityPerSale = 2; // 8 * 2 = 16 attempted sales, only 10 available (max 5 successful)

        ExecutorService executorService = Executors.newFixedThreadPool(numberOfThreads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(numberOfThreads);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);

        for (int i = 0; i < numberOfThreads; i++) {
            executorService.submit(() -> {
                try {
                    startLatch.await();
                    inventoryService.deductStock(
                            testWarehouse.getId(),
                            testProduct.getId(),
                            quantityPerSale,
                            "CONCURRENCY_TEST",
                            null,
                            StockMovementType.SALE,
                            "Concurrent sale test execution"
                    );
                    successCount.incrementAndGet();
                } catch (InsufficientStockException e) {
                    failureCount.incrementAndGet();
                } catch (Exception e) {
                    fail("Unexpected exception: " + e.getMessage());
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        doneLatch.await();
        executorService.shutdown();

        Stock updatedStock = stockRepository.findByWarehouseIdAndProductId(testWarehouse.getId(), testProduct.getId()).orElseThrow();

        assertEquals(5, successCount.get(), "Exactly 5 transactions of 2 units should succeed for 10 units");
        assertEquals(3, failureCount.get(), "Remaining 3 transactions should fail due to insufficient stock");
        assertEquals(0, updatedStock.getPhysicalQuantity(), "Final physical stock should be exactly 0");
        assertTrue(updatedStock.getPhysicalQuantity() >= 0, "Stock must never be negative");
    }
}
