pipeline {
    agent any

    environment {
        S3_BUCKET_NAME = credentials('aws-s3-bucket-name')
        CLOUDFRONT_DISTRIBUTION_ID = credentials('aws-cloudfront-distribution-id')
        DISCORD_WEBHOOK_TEST_URL = credentials('discord-webhook-url')
    }

    stages {
        stage('Checkout Repository') {
            steps {
                script {
                    checkout scm //Jenkins가 자동으로 소스 코드를 체크아웃 및 Jenkinsfile이 위치한 브랜치를 인식하여 가져옴, Git SCM 플러그인 설치 필수
                }
            }
        }

        stage('Build Frontend') {
            steps {
                script {
                    sh 'mkdir -p dist/js'
                    // frontend 내부 모든 파일을 dist로 복사하지만, Jenkinsfile과 .git 폴더는 제외
                    sh 'rsync -av --exclude "Jenkinsfile" --exclude ".git" --exclude ".idea" . dist/'
                }
            }
        }

        stage('Deploy to S3') {
            steps {
                script {
                    // S3 업로드
                    sh "aws s3 sync ./dist/ s3://${S3_BUCKET_NAME} --delete"
                }
            }
        }

        stage('Invalidate CloudFront Cache') {
            steps {
                script {
                    // CloudFront 캐시 무효화
                    sh "aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_DISTRIBUTION_ID} --paths '/*'"
                }
            }
        }
    }

    post {
        success {
            script {
                def TIMESTAMP = sh(script: "date +'%Y-%m-%d %H:%M:%S'", returnStdout: true).trim()
                def BUILD_URL = env.BUILD_URL ?: "Jenkins URL을 가져올 수 없음"
                def S3_LINK = "https://s3.console.aws.amazon.com/s3/buckets/${S3_BUCKET_NAME}"

                sh """curl -H 'Content-Type: application/json' -d '{
                "embeds": [{
                    "title": "✅ FE S3 업로드 성공",
                    "description": "아싸! 성공![S3 확인하기](${S3_LINK}) | [Jenkins 로그](${BUILD_URL})",
                    "color": 3066993,
                    "footer": {
                      "text": "[PROFECT]Oops! Jenkins-FE에서 전송됨 - ${TIMESTAMP}"
                    }
                  }]
                }' ${DISCORD_WEBHOOK_TEST_URL}"""
            }
        }
        failure {
            script {
                def TIMESTAMP = sh(script: "date +'%Y-%m-%d %H:%M:%S'", returnStdout: true).trim()
                def BUILD_URL = env.BUILD_URL ?: "Jenkins URL을 가져올 수 없음"

                sh """curl -H 'Content-Type: application/json' -d '{
                "embeds": [{
                    "title": "❌ FE 배포 실패",
                    "description": "Oops~! [Jenkins 로그 확인하기](${BUILD_URL})",
                    "color": 15158332,
                    "footer": {
                      "text": "[PROFECT]Oops! Jenkins-FE에서 전송됨 - ${TIMESTAMP}"
                    }
                  }]
                }' ${DISCORD_WEBHOOK_TEST_URL}"""
            }
        }
    }
}