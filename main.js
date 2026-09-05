const imageFrame = document.getElementById("imageFrame");


// 마우스가 이미지 위에서 움직일 때
imageFrame.addEventListener("mousemove", (e) => {

    const rect = imageFrame.getBoundingClientRect();


    // 이미지 안에서의 마우스 위치
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;


    // 중앙값
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;


    // -1 ~ 1 사이 값
    const percentX = (mouseX - centerX) / centerX;
    const percentY = (mouseY - centerY) / centerY;


    /*
        좌우 움직임
        숫자를 키우면 더 많이 움직임
    */

    const moveX = percentX * 18;
    const moveY = percentY * 10;


    /*
        살짝 기울어지는 효과
    */

    const rotateY = percentX * 4;
    const rotateX = percentY * -4;


    imageFrame.style.transform = `
        translate(${moveX}px, ${moveY}px)
        rotateX(${rotateX}deg)
        rotateY(${rotateY}deg)
    `;

});


// 이미지에서 마우스를 빼면 원래 위치
imageFrame.addEventListener("mouseleave", () => {

    imageFrame.style.transform = `
        translate(0px, 0px)
        rotateX(0deg)
        rotateY(0deg)
    `;

});