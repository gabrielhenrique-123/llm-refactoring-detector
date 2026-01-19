#include <stdio.h>

int c(int x, int y) {
    return x * x + y * y;
}

int main() {
    int a = 3, b = 4;
    printf("Result: %d\n", c(a, b));
    return 0;
}
