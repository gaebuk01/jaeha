document.addEventListener('DOMContentLoaded', function() {
    // [완료] 1단계: 점수 옵션을 동적으로 생성합니다.
    const scoreSelect = document.getElementById('score');
    for (let i = 10; i <= 100; i += 10) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${i}점`;
        scoreSelect.appendChild(option);
    }

    // =================================================================
    // [추가] 2단계: 구글 시트 연동을 위한 코드
    // =================================================================

    // !!! 중요: 본인의 Google Apps Script 웹 앱 URL로 변경하세요.
    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxZjbhoN6di6nyJpBs-Hk7c4-kh_x0LGgUhnkdYGq-wsG2P1vdW790XuP-ZETtr6BYV/exec'; // 여기에 사용자 URL 입력

    const recordForm = document.getElementById('record-form');
    const recordsContainer = document.getElementById('records-container');
    const exportButton = document.getElementById('export-excel');
    let recordsCache = []; // 데이터를 빠르게 표시하기 위한 캐시

    /**
     * 구글 시트에서 모든 기록을 불러와 화면에 표시합니다.
     */
    const loadRecords = async () => {
        recordsContainer.innerHTML = '<p>데이터를 불러오는 중...</p>';
        try {
            const response = await fetch(WEB_APP_URL);
            if (!response.ok) throw new Error(`HTTP 오류! 상태: ${response.status}`);
            
            recordsCache = await response.json();
            
            if (!Array.isArray(recordsCache)) {
                 throw new Error('데이터 형식이 올바르지 않습니다. Apps Script를 확인하세요.');
            }
            
            // 최신 기록이 위로 오도록 Timestamp 기준으로 정렬합니다.
            recordsCache.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

            recordsContainer.innerHTML = ''; // '로딩 중' 메시지 제거
            if (recordsCache.length === 0) {
                recordsContainer.innerHTML = '<p>아직 기록이 없습니다.</p>';
            } else {
                recordsCache.forEach(addRecordToDOM);
            }

        } catch (error) {
            console.error('기록 로딩 오류:', error);
            recordsContainer.innerHTML = `<p style="color: red;">데이터 로딩에 실패했습니다. 웹 앱 URL과 시트 설정을 확인해주세요.</p>`;
        }
    };

    /**
     * 하나의 기록 데이터를 받아 DOM 요소로 만들어 화면에 추가합니다.
     */
    const addRecordToDOM = (record) => {
        const row = document.createElement('div');
        row.classList.add('record-row');

        const moodEmojis = { '편안': '😌', '기쁨': '☺️', '보통': '🫤', '화남': '😤', '슬픔': '😢' };
        const submissionTime = new Date(record.Timestamp).toLocaleString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });

        // data-label 속성은 모바일 뷰에서 사용됩니다.
        row.innerHTML = `
            <div data-label="시간">${submissionTime}</div>
            <div data-label="닉네임" class="record-nickname">${record.Nickname}</div>
            <div data-label="점수" class="record-score">${record.Score}점</div>
            <div data-label="기분" class="record-mood">${moodEmojis[record.Mood] || record.Mood}</div>
            <div data-label="단어" title="${record.Word}">${record.Word}</div>
            <div data-label="요약" title="${record.Summary}">${record.Summary}</div>
            <div data-label="칭찬/격려" title="${record.Praise}">${record.Praise}</div>
            <div data-label="도움된점" title="${record.Helpful}">${record.Helpful}</div>
        `;
        recordsContainer.appendChild(row);
    };

    /**
     * 폼 제출 이벤트를 처리합니다.
     */
    recordForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // 폼의 기본 제출 동작(새로고침)을 막습니다.

        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = '저장 중...';
        
        // 폼 데이터를 객체로 만듭니다.
        const formData = new FormData(recordForm);
        const data = {
            score: formData.get('score'),
            mood: formData.get('mood'),
            word: formData.get('word'),
            summary: formData.get('summary'),
            praise: formData.get('praise'),
            helpful: formData.get('helpful'),
            nickname: formData.get('nickname')
        };

        try {
            // 구글 앱스 스크립트로 데이터 전송
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify(data),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // 응답을 JSON으로 파싱
            const result = await response.json();

            if(result.result !== "success") {
               throw new Error(result.message || '알 수 없는 오류가 발생했습니다.');
            }
            
            alert('성공적으로 기록되었습니다!');
            recordForm.reset();
            loadRecords(); // 목록을 새로고침합니다.

        } catch (error) {
            console.error('기록 제출 오류:', error);
            alert(`기록 저장에 실패했습니다: ${error.message}`);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = '기록하기';
        }
    });

    // 초기 데이터 로드
    loadRecords();
    
    // 엑셀 내보내기 버튼 (기록된 데이터가 캐시에 있을 때 동작)
    exportButton.addEventListener('click', () => {
        if (recordsCache.length === 0) {
            alert("내보낼 기록이 없습니다.");
            return;
        }

        // CSV 형식으로 데이터 생성 (헤더 포함)
        const headers = ["시간", "닉네임", "점수", "기분", "단어", "요약", "칭찬/격려", "도움된점"];
        let csv = headers.join(',') + '\n';
        
        recordsCache.forEach(record => {
            const row = [
                `"${new Date(record.Timestamp).toLocaleString('ko-KR')}"`, // 시간 형식 지정
                `"${record.Nickname}"`,
                record.Score,
                `"${record.Mood}"`,
                `"${record.Word.replace(/"/g, '""')}"`, // 쌍따옴표 이스케이프 처리
                `"${record.Summary.replace(/"/g, '""')}"`,
                `"${record.Praise.replace(/"/g, '""')}"`,
                `"${record.Helpful.replace(/"/g, '""')}"`
            ];
            csv += row.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `나의_하루_리포트_${new Date().toLocaleDateString('ko-KR').replace(/\./g, '-')}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});