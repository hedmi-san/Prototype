package dz.company.distributor;

import dz.company.distributor.inventory.InventoryService;
import dz.company.distributor.inventory.dto.InitialStockReceiptRequest;
import dz.company.distributor.products.Product;
import dz.company.distributor.products.ProductRepository;
import dz.company.distributor.users.Role;
import dz.company.distributor.users.RoleRepository;
import dz.company.distributor.users.User;
import dz.company.distributor.users.UserRepository;
import dz.company.distributor.warehouses.Warehouse;
import dz.company.distributor.warehouses.WarehouseRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;

@SpringBootApplication
public class DistributorApplication {

    public static void main(String[] args) {
        SpringApplication.run(DistributorApplication.class, args);
    }

    @Bean
    public CommandLineRunner initData(
            UserRepository userRepository,
            RoleRepository roleRepository,
            WarehouseRepository warehouseRepository,
            ProductRepository productRepository,
            InventoryService inventoryService,
            PasswordEncoder passwordEncoder
    ) {
        return args -> {
            // Seed Roles
            Role adminRole = roleRepository.findByName("ADMIN").orElseGet(() -> roleRepository.save(new Role("ADMIN", "System Admin")));
            Role superManagerRole = roleRepository.findByName("SUPER_MANAGER").orElseGet(() -> roleRepository.save(new Role("SUPER_MANAGER", "Super Manager")));
            Role managerRole = roleRepository.findByName("MANAGER").orElseGet(() -> roleRepository.save(new Role("MANAGER", "Warehouse Manager")));
            Role accountantRole = roleRepository.findByName("ACCOUNTANT").orElseGet(() -> roleRepository.save(new Role("ACCOUNTANT", "Warehouse Accountant")));

            // Seed Regional Warehouses
            Warehouse algiers = warehouseRepository.findByCode("WH-ALG").orElseGet(() -> 
                    warehouseRepository.save(new Warehouse("Algiers Central Hub", "WH-ALG", "Zone Industrielle Oued Smar, Alger", "+213 21 00 11 22", true)));
            Warehouse oran = warehouseRepository.findByCode("WH-ORN").orElseGet(() -> 
                    warehouseRepository.save(new Warehouse("Oran West Distribution", "WH-ORN", "Zone Industrielle Es Sénia, Oran", "+213 41 22 33 44", true)));
            Warehouse constantine = warehouseRepository.findByCode("WH-CST").orElseGet(() -> 
                    warehouseRepository.save(new Warehouse("Constantine East Hub", "WH-CST", "Zone Industrielle Didouche Mourad, Constantine", "+213 31 44 55 66", true)));

            // Seed Users with passwords matching quick login
            if (!userRepository.existsByUsername("admin")) {
                User admin = new User("admin", passwordEncoder.encode("AdminPass123!"), "Administrator DZ", adminRole, null);
                userRepository.save(admin);
            }

            if (!userRepository.existsByUsername("manager_algiers")) {
                User mAlg = new User("manager_algiers", passwordEncoder.encode("ManagerPass123!"), "Amine Khelifi (Algiers)", managerRole, algiers);
                userRepository.save(mAlg);
            }

            if (!userRepository.existsByUsername("super_oran")) {
                User sOran = new User("super_oran", passwordEncoder.encode("SuperPass123!"), "Karim Benali (Oran)", superManagerRole, oran);
                userRepository.save(sOran);
            }

            if (!userRepository.existsByUsername("accountant_constantine")) {
                User aCst = new User("accountant_constantine", passwordEncoder.encode("AccountantPass123!"), "Samir Brahimi (Constantine)", accountantRole, constantine);
                userRepository.save(aCst);
            }

            // Seed initial industrial products
            if (productRepository.count() == 0) {
                Product p1 = productRepository.save(new Product(
                        "BOSCH-GBH-226",
                        "Rotary Hammer GBH 2-26 DRE Professional",
                        "Bosch",
                        "Power Tools",
                        "Heavy-duty SDS Plus rotary hammer 800W",
                        BigDecimal.valueOf(21500.00),
                        BigDecimal.valueOf(28000.00),
                        5
                ));
                Product p2 = productRepository.save(new Product(
                        "MAKITA-DGA-504",
                        "Cordless Angle Grinder DGA504Z 18V",
                        "Makita",
                        "Cordless Tools",
                        "Brushless 125mm cordless angle grinder",
                        BigDecimal.valueOf(18500.00),
                        BigDecimal.valueOf(24500.00),
                        4
                ));
                Product p3 = productRepository.save(new Product(
                        "DEWALT-DCD-796",
                        "Compact Hammer Drill DCD796P2",
                        "DeWalt",
                        "Cordless Tools",
                        "18V XR Li-Ion brushless compact combi drill",
                        BigDecimal.valueOf(29000.00),
                        BigDecimal.valueOf(36500.00),
                        6
                ));
                Product p4 = productRepository.save(new Product(
                        "STANLEY-STMT-74311",
                        "Socket Set 1/2 + 1/4 (120 Pcs)",
                        "Stanley",
                        "Hand Tools",
                        "Professional mechanics chrome vanadium socket set",
                        BigDecimal.valueOf(14000.00),
                        BigDecimal.valueOf(18500.00),
                        8
                ));
                Product p5 = productRepository.save(new Product(
                        "HILTI-TE-50-AVR",
                        "Combihammer TE 50-AVR SDS Max",
                        "Hilti",
                        "Heavy Construction",
                        "Powerful SDS-max combihammer with AVR",
                        BigDecimal.valueOf(95000.00),
                        BigDecimal.valueOf(125000.00),
                        2
                ));

                // Seed initial stock levels
                inventoryService.recordInitialStock(new InitialStockReceiptRequest(algiers.getId(), p1.getId(), 25, "Initial factory shipment"));
                inventoryService.recordInitialStock(new InitialStockReceiptRequest(algiers.getId(), p2.getId(), 30, "Initial factory shipment"));
                inventoryService.recordInitialStock(new InitialStockReceiptRequest(algiers.getId(), p3.getId(), 15, "Initial factory shipment"));
                inventoryService.recordInitialStock(new InitialStockReceiptRequest(algiers.getId(), p4.getId(), 40, "Initial factory shipment"));
                inventoryService.recordInitialStock(new InitialStockReceiptRequest(algiers.getId(), p5.getId(), 8, "Initial factory shipment"));

                inventoryService.recordInitialStock(new InitialStockReceiptRequest(oran.getId(), p1.getId(), 12, "Regional transfer allocation"));
                inventoryService.recordInitialStock(new InitialStockReceiptRequest(oran.getId(), p2.getId(), 18, "Regional transfer allocation"));
                inventoryService.recordInitialStock(new InitialStockReceiptRequest(oran.getId(), p4.getId(), 20, "Regional transfer allocation"));

                inventoryService.recordInitialStock(new InitialStockReceiptRequest(constantine.getId(), p1.getId(), 10, "East hub stock receipt"));
                inventoryService.recordInitialStock(new InitialStockReceiptRequest(constantine.getId(), p3.getId(), 12, "East hub stock receipt"));
            }
        };
    }
}
